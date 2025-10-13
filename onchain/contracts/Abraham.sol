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
/**
 * Real staking contract we READ ONLY.
 * We only need stakedAmount. ABI you provided returns (stakedAmount, lockedUntil).
 */
interface IStakingPool {
    struct StakingInfo { uint256 stakedAmount; uint256 lockedUntil; }
    function getStakingInfo(address staker) external view returns (StakingInfo memory stakingInfo);
}

/**
 * Abraham Creations:
 * - Users stake in an external staking pool (not controlled here).
 * - This contract links portions of that stake to specific creations (sessionId) when:
 *     • making a **commandment** (user-authored message, formerly "bless"), or
 *     • making a **blessing** (endorse a message, formerly "praise").
 * - Linked stake accrues time-weighted curation points per (user, session).
 * - Daily action limits are enforced by **tiers** based on the user's stakedAmount in the external pool.
 */
contract Abraham is Ownable, ReentrancyGuard {
    constructor(address stakingPool_) Ownable(msg.sender) ReentrancyGuard() {
        require(stakingPool_ != address(0), "staking=0");
        stakingPool = IStakingPool(stakingPool_);
    }

    /*──────────────── external staking ───────────────*/
    IStakingPool public immutable stakingPool;

    /*──────────────── requirements (link deltas per action) ─────────*/
    uint256 public blessingRequirement    = 10e18; // per single blessing (endorsement)
    uint256 public commandmentRequirement = 20e18; // per single commandment (user-authored message)

    /*──────────────── daily limits via tiers ─────────*/
    struct Tier {
        uint256 minStake;           // inclusive minimum stakedAmount in external pool
        uint32  maxBlessingsPerDay; // per-address daily cap
        uint32  maxCommandmentsPerDay;
    }
    Tier[] public tiers; // sorted ascending by minStake

    /*──────────────── data model ─────────*/
    struct Message {
        string   id;         // per-session message id
        address  author;
        string   cid;        // IPFS JSON
        uint256  blessingCount; // endorsements received
    }

    struct Session {
        string   id;               // sessionId string (UUID)
        string[] messageIds;       // ordering
        uint256  messageCount;
        uint256  totalCommandments; // user-authored messages count
        uint256  totalBlessings;    // total endorsements count
        bool     closed;
        uint256  linkedTotal;       // sum of linked stake for this session
    }

    struct OwnerMsg { string messageId; string cid; }
    struct CreateItem { string sessionId; string firstMessageId; string cid; }
    struct UpdateItem { string sessionId; string messageId; string cid; bool closed; }

    struct UserDaily {
        uint64 day;               // day index (unix/1 day)
        uint32 blessingsToday;    // endorsements made today
        uint32 commandmentsToday; // commandments made today
    }

    struct LinkInfo {
        uint256 linkedAmount;   // current linked for (user, session)
        uint256 lastUpdate;     // last accrual timestamp
        uint256 pointsAccrued;  // token-wei-seconds
    }

    /*──────────────── storage ─────────*/
    mapping(string => Session) private sessions;                    // sessionId → Session
    mapping(string => mapping(string => Message)) private messages; // sessionId → messageId → Message
    mapping(string => mapping(address => LinkInfo)) private links;  // sessionId → user → LinkInfo
    mapping(address => uint256) private totalLinkedByUser;          // across all sessions
    mapping(address => UserDaily) private daily;                    // per-address rolling window
    uint256 public sessionTotal;

    /*──────────────── events ─────────*/
    event SessionCreated(string sessionId);
    event SessionClosed(string sessionId);
    event SessionReopened(string sessionId);
    event MessageAdded(string sessionId, string messageId, address author, string cid);
    event Blessed(string sessionId, string messageId, address blesser); // endorsement made

    // Non-indexed sessionId so subgraph gets the actual string (simpler id)
    event LinkedStake(address indexed user, string sessionId, uint256 delta, uint256 userSessionLinked, uint256 sessionLinkedTotal);

    /*──────────────── modifiers ───────*/
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

    /*──────────────── public/external ─────────*/

    /// Create a new session with its first owner message (CID).
    function createSession(
        string calldata sessionId,
        string calldata firstMessageId,
        string calldata cid
    )
        external
        onlyOwner
        uniqueSession(sessionId)
        uniqueMessage(sessionId, firstMessageId)
    {
        _requireCID(cid);

        Session storage s = sessions[sessionId];
        s.id = sessionId;
        s.closed = false;
        s.messageCount = 0;
        s.totalCommandments = 0;
        s.totalBlessings = 0;
        s.linkedTotal = 0;

        _addMessageInternal(s, firstMessageId, msg.sender, cid, /*isCommandment*/ false);

        unchecked { ++sessionTotal; }
        emit SessionCreated(sessionId);
    }

    /// Owner posts an update and toggles open/closed.
    function abrahamUpdate(
        string calldata sessionId,
        string calldata messageId,
        string calldata cid,
        bool closed
    )
        external
        onlyOwner
        sessionExists(sessionId)
        uniqueMessage(sessionId, messageId)
    {
        _requireCID(cid);
        Session storage s = sessions[sessionId];
        _abrahamUpdateInternal(s, messageId, cid, closed);
    }

    /// Make a COMMANDMENT (user-authored message), formerly "bless".
    function commandment(
        string calldata sessionId,
        string calldata messageId,
        string calldata cid
    )
        external
        nonReentrant
        sessionExists(sessionId)
        uniqueMessage(sessionId, messageId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");
        _requireCID(cid);

        // daily limit check and bump
        _checkAndBumpDaily(msg.sender, /*isBlessing*/ false, /*count*/ 1);

        // link stake for this action
        _linkAndAccrue(sessionId, msg.sender, commandmentRequirement);

        // write message
        _addMessageInternal(s, messageId, msg.sender, cid, /*isCommandment*/ true);
    }

    /// Make a BLESSING (endorse a message), formerly "praise".
    function blessing(
        string calldata sessionId,
        string calldata messageId
    )
        external
        nonReentrant
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");

        Message storage m = messages[sessionId][messageId];
        require(bytes(m.id).length != 0, "Message not found");

        // daily limit check and bump
        _checkAndBumpDaily(msg.sender, /*isBlessing*/ true, /*count*/ 1);

        // link stake for this action
        _linkAndAccrue(sessionId, msg.sender, blessingRequirement);

        unchecked {
            ++m.blessingCount;
            ++s.totalBlessings;
        }

        emit Blessed(sessionId, messageId, msg.sender);
    }

    /*──────────────── batch (users) ───────*/

    /// Batch endorse multiple messages (BLESSINGS).
    function batchBlessing(
        string calldata sessionId,
        string[] calldata messageIds
    )
        external
        nonReentrant
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");

        uint256 n = messageIds.length;
        require(n > 0, "No items");
        for (uint256 i = 0; i < n; i++) {
            require(bytes(messages[sessionId][messageIds[i]].id).length != 0, "Message not found");
        }

        _checkAndBumpDaily(msg.sender, /*isBlessing*/ true, /*count*/ n);

        // link stake for all
        _linkAndAccrue(sessionId, msg.sender, blessingRequirement * n);

        for (uint256 i = 0; i < n; i++) {
            Message storage m = messages[sessionId][messageIds[i]];
            unchecked {
                ++m.blessingCount;
                ++s.totalBlessings;
            }
            emit Blessed(sessionId, messageIds[i], msg.sender);
        }
    }

    /// Batch create COMMANDMENTS (user-authored messages).
    function batchCommandment(
        string calldata sessionId,
        string[] calldata messageIds,
        string[] calldata cids
    )
        external
        nonReentrant
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");

        uint256 n = messageIds.length;
        require(n > 0, "No items");
        require(n == cids.length, "Length mismatch");

        for (uint256 i = 0; i < n; i++) {
            string calldata mid = messageIds[i];
            require(bytes(messages[sessionId][mid].id).length == 0, "Message exists");
            _requireCID(cids[i]);
        }

        _checkAndBumpDaily(msg.sender, /*isBlessing*/ false, /*count*/ n);

        // link stake for all
        _linkAndAccrue(sessionId, msg.sender, commandmentRequirement * n);

        for (uint256 i = 0; i < n; i++) {
            _addMessageInternal(s, messageIds[i], msg.sender, cids[i], /*isCommandment*/ true);
        }
    }

    /*──────────── owner batch (single/cross session) ───────────*/

    function abrahamBatchUpdate(
        string calldata sessionId,
        OwnerMsg[] calldata items,
        bool closedAfter
    )
        external
        onlyOwner
        sessionExists(sessionId)
    {
        uint256 n = items.length;
        require(n > 0, "No items");

        Session storage s = sessions[sessionId];

        for (uint256 i = 0; i < n; i++) {
            OwnerMsg calldata it = items[i];
            require(bytes(messages[sessionId][it.messageId].id).length == 0, "Message exists");
            _requireCID(it.cid);
            _addMessageInternal(s, it.messageId, msg.sender, it.cid, /*isCommandment*/ false);
        }

        if (s.closed != closedAfter) {
            s.closed = closedAfter;
            if (closedAfter) emit SessionClosed(sessionId); else emit SessionReopened(sessionId);
        }
    }

    function abrahamBatchCreate(CreateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            CreateItem calldata it = items[i];

            require(bytes(sessions[it.sessionId].id).length == 0, "Session exists");
            require(bytes(messages[it.sessionId][it.firstMessageId].id).length == 0, "Message exists");
            _requireCID(it.cid);

            Session storage s = sessions[it.sessionId];
            s.id = it.sessionId;
            s.closed = false;
            s.messageCount = 0;
            s.totalCommandments = 0;
            s.totalBlessings = 0;
            s.linkedTotal = 0;

            _addMessageInternal(s, it.firstMessageId, msg.sender, it.cid, /*isCommandment*/ false);

            unchecked { ++sessionTotal; }
            emit SessionCreated(it.sessionId);
        }
    }

    function abrahamBatchUpdateAcrossSessions(UpdateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            UpdateItem calldata it = items[i];

            require(bytes(sessions[it.sessionId].id).length != 0, "Session not found");
            require(bytes(messages[it.sessionId][it.messageId].id).length == 0, "Message exists");
            _requireCID(it.cid);

            Session storage s = sessions[it.sessionId];

            _addMessageInternal(s, it.messageId, msg.sender, it.cid, /*isCommandment*/ false);

            if (s.closed != it.closed) {
                s.closed = it.closed;
                if (it.closed) emit SessionClosed(it.sessionId); else emit SessionReopened(it.sessionId);
            }
        }
    }

    /*──────────────── views ───────────*/

    function getMessage(
        string calldata sessionId,
        string calldata messageId
    )
        external
        view
        returns (
            address author,
            string memory cid,
            uint256 blessingCount
        )
    {
        Message storage m = messages[sessionId][messageId];
        require(bytes(m.id).length != 0, "Message not found");
        return (m.author, m.cid, m.blessingCount);
    }

    function getMessageIds(string calldata sessionId) external view returns (string[] memory) {
        return sessions[sessionId].messageIds;
    }

    function isSessionClosed(string calldata sessionId) external view returns (bool) {
        return sessions[sessionId].closed;
    }

    function getSessionStats(string calldata sessionId)
        external
        view
        returns (uint256 messageCount, uint256 totalCommandments, uint256 totalBlessings, bool closed, uint256 linkedTotal)
    {
        Session storage s = sessions[sessionId];
        require(bytes(s.id).length != 0, "Session not found");
        return (s.messageCount, s.totalCommandments, s.totalBlessings, s.closed, s.linkedTotal);
    }

    function getUserLinkInfo(string calldata sessionId, address user)
        external
        view
        returns (uint256 linkedAmount, uint256 lastUpdate, uint256 pointsAccrued)
    {
        LinkInfo storage li = links[sessionId][user];
        return (li.linkedAmount, li.lastUpdate, li.pointsAccrued);
    }

    function getUserTotalLinked(address user) external view returns (uint256) {
        return totalLinkedByUser[user];
    }

    /// Returns the active tier for a user (based on current external staked amount)
    function getUserTier(address user)
        public
        view
        returns (uint32 maxBlessings, uint32 maxCommandments)
    {
        uint256 stake = _stakedBalance(user);
        uint256 best = 0;
        uint32 b = 0;
        uint32 c = 0;
        for (uint256 i = 0; i < tiers.length; i++) {
            if (stake >= tiers[i].minStake && tiers[i].minStake >= best) {
                best = tiers[i].minStake;
                b = tiers[i].maxBlessingsPerDay;
                c = tiers[i].maxCommandmentsPerDay;
            }
        }
        return (b, c);
    }

    /// Returns today's usage counters for a user.
    function getUserDaily(address user) external view returns (uint64 day, uint32 blessingsToday, uint32 commandmentsToday) {
        UserDaily storage d = daily[user];
        return (d.day, d.blessingsToday, d.commandmentsToday);
    }

    /*──────────────── admin ──────────*/

    function setRequirements(uint256 newBlessingRequirement, uint256 newCommandmentRequirement) external onlyOwner {
        require(newBlessingRequirement > 0 && newCommandmentRequirement > 0, "invalid req");
        blessingRequirement    = newBlessingRequirement;
        commandmentRequirement = newCommandmentRequirement;
    }

    /// Replace all tiers (sorted ascending by minStake).
    function setTiers(Tier[] calldata newTiers) external onlyOwner {
        delete tiers;
        for (uint256 i = 0; i < newTiers.length; i++) {
            tiers.push(newTiers[i]);
        }
    }

    /*──────────────── internals ──────*/

    function _requireCID(string calldata cid) private pure {
        require(bytes(cid).length > 0, "CID required");
    }

    function _addMessageInternal(
        Session storage s,
        string memory messageId,
        address author,
        string memory cid,
        bool isCommandment
    ) private {
        messages[s.id][messageId] = Message({
            id: messageId,
            author: author,
            cid: cid,
            blessingCount: 0
        });

        s.messageIds.push(messageId);
        unchecked {
            ++s.messageCount;
            if (isCommandment) ++s.totalCommandments;
        }

        emit MessageAdded(s.id, messageId, author, cid);
    }

    function _abrahamUpdateInternal(
        Session storage s,
        string memory messageId,
        string memory cid,
        bool closed
    ) private {
        _addMessageInternal(s, messageId, msg.sender, cid, /*isCommandment*/ false);
        if (s.closed != closed) {
            s.closed = closed;
            if (closed) emit SessionClosed(s.id); else emit SessionReopened(s.id);
        }
    }

    function _currentDay() private view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    function _stakedBalance(address user) private view returns (uint256) {
        IStakingPool.StakingInfo memory info = stakingPool.getStakingInfo(user);
        return info.stakedAmount;
    }

    /// Checks and bumps daily usage against the user's tier caps.
    function _checkAndBumpDaily(address user, bool isBlessing, uint256 count) private {
        (uint32 maxB, uint32 maxC) = getUserTier(user);
        require(maxB > 0 || maxC > 0, "no tier");

        UserDaily storage d = daily[user];
        uint64 today = _currentDay();
        if (d.day != today) {
            d.day = today;
            d.blessingsToday = 0;
            d.commandmentsToday = 0;
        }

        if (isBlessing) {
            require(d.blessingsToday + count <= maxB, "blessing/day cap");
            d.blessingsToday += uint32(count);
        } else {
            require(d.commandmentsToday + count <= maxC, "commandment/day cap");
            d.commandmentsToday += uint32(count);
        }
    }

    /**
     * Accrue points for (user, session), then increase link by delta.
     * Revert if user's global staked < new total linked across all sessions.
     */
    function _linkAndAccrue(string calldata sessionId, address user, uint256 delta) private {
        LinkInfo storage li = links[sessionId][user];
        if (li.lastUpdate == 0) {
            li.lastUpdate = block.timestamp;
        } else {
            if (li.linkedAmount > 0) {
                li.pointsAccrued += li.linkedAmount * (block.timestamp - li.lastUpdate);
            }
            li.lastUpdate = block.timestamp;
        }

        uint256 newTotalLinked = totalLinkedByUser[user] + delta;
        require(_stakedBalance(user) >= newTotalLinked, "insufficient global stake");

        li.linkedAmount += delta;
        Session storage s = sessions[sessionId];
        s.linkedTotal += delta;
        totalLinkedByUser[user] = newTotalLinked;

        emit LinkedStake(user, sessionId, delta, li.linkedAmount, s.linkedTotal);
    }

    /* receive/fallback */
    receive() external payable {}
    fallback() external payable {}
}
