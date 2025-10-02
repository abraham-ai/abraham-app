// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* --------------------- minimal Ownable --------------------- */
abstract contract Ownable {
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != _owner) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }

    function owner() public view returns (address) { return _owner; }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

/* ------------------ minimal ReentrancyGuard ---------------- */
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;
    uint256 private _status;
    constructor() { _status = _NOT_ENTERED; }
    modifier nonReentrant() {
        require(_status != _ENTERED, "REENTRANCY");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

/* ------------------- external staking iface --------------- */
interface IAbrahamStakingView {
    function stakedBalance(address user) external view returns (uint256);
}

/**
 * Abraham: creations + linking logic (uses external staking vault).
 * - Users stake globally in AbrahamStaking.
 * - On bless / praise, this contract:
 *    1) accrues points for (user, session) up to now,
 *    2) increases that session's linked amount by Δ (X or N),
 *    3) checks global constraint: totalLinked[user] <= staking.stakedBalance(user),
 *    4) records the action (message or praise).
 * - Past actions are permanent; linked amounts never decrease.
 */
contract Abraham is Ownable, ReentrancyGuard {
    constructor(address staking_) Ownable(msg.sender) ReentrancyGuard() {
        require(staking_ != address(0), "staking=0");
        staking = IAbrahamStakingView(staking_);
    }

    IAbrahamStakingView public immutable staking;

    /*──────── parameters ────────*/
    uint256 public praiseRequirement = 10e18; // N
    uint256 public blessRequirement  = 20e18; // X

    /*──────── structs ───────────*/
    struct Message {
        string   id;
        address  author;
        string   cid;
        uint256  praiseCount;
    }

    struct Session {
        string   id;
        string[] messageIds;
        uint256  messageCount;
        uint256  totalBlessings;
        uint256  totalPraises;
        bool     closed;
        uint256  linkedTotal;  // sum of all users' linked amounts for this session
    }

    struct OwnerMsg { string messageId; string cid; }
    struct CreateItem { string sessionId; string firstMessageId; string cid; }
    struct UpdateItem { string sessionId; string messageId; string cid; bool closed; }

    struct UserUsage {
        uint64 praisesMade;
        uint64 blessingsMade;
    }

    struct LinkInfo {
        uint256 linkedAmount;   // current linked for this (user, session)
        uint256 lastUpdate;     // last accrual timestamp
        uint256 pointsAccrued;  // token-wei-seconds on linkedAmount
    }

    /*──────── storage ───────────*/
    mapping(string => Session) private sessions;                    // sessionId → Session
    mapping(string => mapping(string => Message)) private messages; // sessionId → messageId → Message
    mapping(string => mapping(address => UserUsage)) private usage; // sessionId → user → usage
    mapping(string => mapping(address => LinkInfo)) private links;  // sessionId → user → link info
    mapping(address => uint256) private totalLinkedByUser;          // aggregate across all sessions
    uint256 public sessionTotal;

    /*──────── events ────────────*/
    event SessionCreated(string sessionId);
    event SessionClosed(string sessionId);
    event SessionReopened(string sessionId);
    event MessageAdded(string sessionId, string messageId, address author, string cid);
    event Praised(string sessionId, string messageId, address praiser);

    // linking (for subgraph)
    event LinkedStake(address indexed user, string indexed sessionId, uint256 delta, uint256 userSessionLinked, uint256 sessionLinkedTotal);

    /*──────── modifiers ─────────*/
    modifier sessionExists(string memory sessionId) {
        require(bytes(sessions[sessionId].id).length != 0, "Session not found");
        _;
    }
    modifier uniqueSession(string memory sessionId) {
        require(bytes(sessions[sessionId].id).length == 0, "Session exists");
        _;
    }
    modifier uniqueMessage(string memory sessionId, string memory messageId) {
        require(bytes(messages[sessionId][messageId].id).length == 0, "Message exists");
        _;
    }

    /*──────── public/external ───*/

    function createSession(string calldata sessionId, string calldata firstMessageId, string calldata cid)
        external onlyOwner uniqueSession(sessionId) uniqueMessage(sessionId, firstMessageId)
    {
        _requireCID(cid);

        Session storage s = sessions[sessionId];
        s.id = sessionId;
        s.closed = false;
        s.messageCount = 0;
        s.totalBlessings = 0;
        s.totalPraises = 0;
        s.linkedTotal = 0;

        _addMessageInternal(s, firstMessageId, msg.sender, cid, false);

        unchecked { ++sessionTotal; }
        emit SessionCreated(sessionId);
    }

    function abrahamUpdate(string calldata sessionId, string calldata messageId, string calldata cid, bool closed)
        external onlyOwner sessionExists(sessionId) uniqueMessage(sessionId, messageId)
    {
        _requireCID(cid);
        Session storage s = sessions[sessionId];
        _abrahamUpdateInternal(s, messageId, cid, closed);
    }

    function bless(string calldata sessionId, string calldata messageId, string calldata cid)
        external nonReentrant sessionExists(sessionId) uniqueMessage(sessionId, messageId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");
        _requireCID(cid);

        UserUsage storage u = usage[sessionId][msg.sender];
        _linkAndAccrue(sessionId, msg.sender, u, /*delta*/ blessRequirement, /*isBless*/ true);

        _addMessageInternal(s, messageId, msg.sender, cid, true);
    }

    function praise(string calldata sessionId, string calldata messageId)
        external nonReentrant sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");

        Message storage m = messages[sessionId][messageId];
        require(bytes(m.id).length != 0, "Message not found");

        UserUsage storage u = usage[sessionId][msg.sender];
        _linkAndAccrue(sessionId, msg.sender, u, /*delta*/ praiseRequirement, /*isBless*/ false);

        unchecked {
            ++u.praisesMade;
            ++m.praiseCount;
            ++s.totalPraises;
        }
        emit Praised(sessionId, messageId, msg.sender);
    }

    /*──────── batch (users) ─────*/

    function batchPraise(string calldata sessionId, string[] calldata messageIds)
        external nonReentrant sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");
        uint256 n = messageIds.length; require(n > 0, "No items");
        for (uint256 i = 0; i < n; i++) {
            require(bytes(messages[sessionId][messageIds[i]].id).length != 0, "Message not found");
        }

        UserUsage storage u = usage[sessionId][msg.sender];
        _linkAndAccrue(sessionId, msg.sender, u, praiseRequirement * n, false);

        for (uint256 i = 0; i < n; i++) {
            Message storage m = messages[sessionId][messageIds[i]];
            unchecked {
                ++u.praisesMade;
                ++m.praiseCount;
                ++s.totalPraises;
            }
            emit Praised(sessionId, messageIds[i], msg.sender);
        }
    }

    function batchBless(string calldata sessionId, string[] calldata messageIds, string[] calldata cids)
        external nonReentrant sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");
        uint256 n = messageIds.length; require(n > 0, "No items");
        require(n == cids.length, "Length mismatch");

        for (uint256 i = 0; i < n; i++) {
            string calldata mid = messageIds[i];
            require(bytes(messages[sessionId][mid].id).length == 0, "Message exists");
            _requireCID(cids[i]);
        }

        UserUsage storage u = usage[sessionId][msg.sender];
        _linkAndAccrue(sessionId, msg.sender, u, blessRequirement * n, true);

        for (uint256 i = 0; i < n; i++) {
            _addMessageInternal(s, messageIds[i], msg.sender, cids[i], true);
            unchecked { ++u.blessingsMade; }
        }
    }

    /*──── owner batch (single/cross session) ────*/

    function abrahamBatchUpdate(string calldata sessionId, OwnerMsg[] calldata items, bool closedAfter)
        external onlyOwner sessionExists(sessionId)
    {
        uint256 n = items.length; require(n > 0, "No items");
        Session storage s = sessions[sessionId];
        for (uint256 i = 0; i < n; i++) {
            OwnerMsg calldata it = items[i];
            require(bytes(messages[sessionId][it.messageId].id).length == 0, "Message exists");
            _requireCID(it.cid);
            _addMessageInternal(s, it.messageId, msg.sender, it.cid, false);
        }
        if (s.closed != closedAfter) {
            s.closed = closedAfter;
            if (closedAfter) emit SessionClosed(sessionId); else emit SessionReopened(sessionId);
        }
    }

    function abrahamBatchCreate(CreateItem[] calldata items) external onlyOwner {
        uint256 n = items.length; require(n > 0, "No items");
        for (uint256 i = 0; i < n; i++) {
            CreateItem calldata it = items[i];
            require(bytes(sessions[it.sessionId].id).length == 0, "Session exists");
            require(bytes(messages[it.sessionId][it.firstMessageId].id).length == 0, "Message exists");
            _requireCID(it.cid);

            Session storage s = sessions[it.sessionId];
            s.id = it.sessionId;
            s.closed = false;
            s.messageCount = 0;
            s.totalBlessings = 0;
            s.totalPraises = 0;
            s.linkedTotal = 0;

            _addMessageInternal(s, it.firstMessageId, msg.sender, it.cid, false);

            unchecked { ++sessionTotal; }
            emit SessionCreated(it.sessionId);
        }
    }

    function abrahamBatchUpdateAcrossSessions(UpdateItem[] calldata items) external onlyOwner {
        uint256 n = items.length; require(n > 0, "No items");
        for (uint256 i = 0; i < n; i++) {
            UpdateItem calldata it = items[i];
            require(bytes(sessions[it.sessionId].id).length != 0, "Session not found");
            require(bytes(messages[it.sessionId][it.messageId].id).length == 0, "Message exists");
            _requireCID(it.cid);

            Session storage s = sessions[it.sessionId];
            _addMessageInternal(s, it.messageId, msg.sender, it.cid, false);
            if (s.closed != it.closed) {
                s.closed = it.closed;
                if (it.closed) emit SessionClosed(it.sessionId); else emit SessionReopened(it.sessionId);
            }
        }
    }

    /*──────── views ─────────────*/

    function getMessage(string calldata sessionId, string calldata messageId)
        external view returns (address author, string memory cid, uint256 praiseCount)
    {
        Message storage m = messages[sessionId][messageId];
        require(bytes(m.id).length != 0, "Message not found");
        return (m.author, m.cid, m.praiseCount);
    }

    function getMessageIds(string calldata sessionId) external view returns (string[] memory) {
        return sessions[sessionId].messageIds;
    }

    function isSessionClosed(string calldata sessionId) external view returns (bool) {
        return sessions[sessionId].closed;
    }

    function getSessionStats(string calldata sessionId)
        external view
        returns (uint256 messageCount, uint256 totalBlessings, uint256 totalPraises, bool closed, uint256 linkedTotal)
    {
        Session storage s = sessions[sessionId];
        require(bytes(s.id).length != 0, "Session not found");
        return (s.messageCount, s.totalBlessings, s.totalPraises, s.closed, s.linkedTotal);
    }

    function getUserUsage(string calldata sessionId, address user)
        external view returns (uint64 praisesMade_, uint64 blessingsMade_)
    {
        UserUsage storage u = usage[sessionId][user];
        return (u.praisesMade, u.blessingsMade);
    }

    function getUserLinkInfo(string calldata sessionId, address user)
        external view returns (uint256 linkedAmount, uint256 lastUpdate, uint256 pointsAccrued)
    {
        LinkInfo storage li = links[sessionId][user];
        return (li.linkedAmount, li.lastUpdate, li.pointsAccrued);
    }

    function getUserTotalLinked(address user) external view returns (uint256) {
        return totalLinkedByUser[user];
    }

    /*──────── admin ─────────────*/

    function setRequirements(uint256 newPraiseRequirement, uint256 newBlessRequirement) external onlyOwner {
        require(newPraiseRequirement > 0 && newBlessRequirement > 0, "invalid req");
        praiseRequirement = newPraiseRequirement;
        blessRequirement  = newBlessRequirement;
    }

    /*──────── internals ────────*/

    function _requireCID(string calldata cid) private pure {
        require(bytes(cid).length > 0, "CID required");
    }

    function _addMessageInternal(Session storage s, string memory messageId, address author, string memory cid, bool isBlessing) private {
        messages[s.id][messageId] = Message({ id: messageId, author: author, cid: cid, praiseCount: 0 });
        s.messageIds.push(messageId);
        unchecked {
            ++s.messageCount;
            if (isBlessing) ++s.totalBlessings;
        }
        emit MessageAdded(s.id, messageId, author, cid);
    }

    function _abrahamUpdateInternal(Session storage s, string memory messageId, string memory cid, bool closed) private {
        _addMessageInternal(s, messageId, msg.sender, cid, false);
        if (s.closed != closed) {
            s.closed = closed;
            if (closed) emit SessionClosed(s.id); else emit SessionReopened(s.id);
        }
    }

    /**
     * Accrue points for (user, session), then try to increase link by delta.
     * Revert if user's global staked < new total linked across all sessions.
     */
    function _linkAndAccrue(string calldata sessionId, address user, UserUsage storage u, uint256 delta, bool isBless) private {
        // accrue existing link up to now
        LinkInfo storage li = links[sessionId][user];
        if (li.lastUpdate == 0) {
            li.lastUpdate = block.timestamp;
        } else if (li.linkedAmount > 0) {
            li.pointsAccrued += li.linkedAmount * (block.timestamp - li.lastUpdate);
            li.lastUpdate = block.timestamp;
        } else {
            li.lastUpdate = block.timestamp;
        }

        // compute new totals (cross-session) to enforce capacity
        uint256 newTotalLinked = totalLinkedByUser[user] + delta;
        uint256 globallyStaked = staking.stakedBalance(user);
        require(globallyStaked >= newTotalLinked, "insufficient global stake");

        // apply link increases
        li.linkedAmount += delta;
        if (isBless) {
            unchecked { ++u.blessingsMade; }
        }
        sessions[sessionId].linkedTotal += delta;
        totalLinkedByUser[user] = newTotalLinked;

        emit LinkedStake(user, sessionId, delta, li.linkedAmount, sessions[sessionId].linkedTotal);
    }

    /* receive/fallback harmless */
    receive() external payable {}
    fallback() external payable {}
}
