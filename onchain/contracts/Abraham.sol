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

    function owner() public view returns (address) {
        return _owner;
    }

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

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "REENTRANCY");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

/* ---------------- AbrahamStaking interface ---------------- */
interface IAbrahamStaking {
    function stakedBalance(address user, string calldata sessionId) external view returns (uint256);
}

/**
 * Abraham (staking-gated edition):
 * - Messages are stored by CID; sessions group messages ("creations").
 * - Users must stake per-session in AbrahamStaking to gain capacity for actions.
 * - Required stake capacity = praisesMade * N + blessingsMade * X (per session, per user).
 * - Batch actions check capacity for the whole batch atomically.
 * - Unstaking doesn't remove past actions (conviction-like permanence).
 */
contract Abraham is Ownable, ReentrancyGuard {
    constructor(address staking_) Ownable(msg.sender) ReentrancyGuard() {
        require(staking_ != address(0), "staking=0");
        stakingContract = IAbrahamStaking(staking_);
    }

    /*──────────────────────── parameters ───────────────────────*/
    // Global requirements (token-wei). Owner can update.
    uint256 public praiseRequirement = 10e18; // N
    uint256 public blessRequirement  = 20e18; // X

    /*──────────────────────── structs ─────────────────────────*/
    struct Message {
        string   id;          // uuid
        address  author;
        string   cid;         // IPFS CID
        uint256  praiseCount; // number of praises
    }

    struct Session {
        string   id;               // uuid
        string[] messageIds;       // ordering
        uint256  messageCount;
        uint256  totalBlessings;   // user-authored messages
        uint256  totalPraises;     // total praises
        bool     closed;           // true ⇢ no praises / blessings
    }

    struct OwnerMsg {
        string messageId;
        string cid; // IPFS CID
    }

    struct CreateItem {
        string sessionId;
        string firstMessageId;
        string cid; // IPFS CID
    }

    struct UpdateItem {
        string sessionId;
        string messageId;
        string cid;   // IPFS CID
        bool   closed;  // desired state after posting
    }

    struct UserUsage {
        uint64 praisesMade;    // per-user per-session
        uint64 blessingsMade;  // per-user per-session
    }

    /*──────────────────────── storage ─────────────────────────*/
    mapping(string => Session) private sessions;                    // sessionId → Session
    mapping(string => mapping(string => Message)) private messages; // sessionId → messageId → Message
    mapping(string => mapping(address => UserUsage)) private usage; // sessionId → user → usage
    uint256 public sessionTotal; // analytics

    IAbrahamStaking public immutable stakingContract;

    /*──────────────────────── events ──────────────────────────*/
    event SessionCreated(string sessionId);
    event SessionClosed(string sessionId);
    event SessionReopened(string sessionId);
    event MessageAdded(string sessionId, string messageId, address author, string cid);
    event Praised(string sessionId, string messageId, address praiser);

    /*──────────────────────── modifiers ───────────────────────*/
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

    /*──────────────────────── public / external ───────────────*/

    /// @notice Create a new session with its first message (IPFS CID).
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
        _requireNonEmptyCID(cid);

        Session storage s = sessions[sessionId];
        s.id = sessionId;
        s.closed = false;
        s.messageCount = 0;
        s.totalBlessings = 0;
        s.totalPraises = 0;

        _addMessageInternal(s, firstMessageId, msg.sender, cid, /*isBlessing*/ false);

        unchecked { ++sessionTotal; }
        emit SessionCreated(sessionId);
    }

    /**
     * @notice Abraham adds a message (by CID) and can close/reopen the session.
     * @param closed Desired session state after this call.
     */
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
        _requireNonEmptyCID(cid);
        Session storage s = sessions[sessionId];
        _abrahamUpdateInternal(s, messageId, cid, closed);
    }

    /// @notice Any user adds a blessing (user-authored message by CID).
    ///         Requires sufficient stake capacity in THIS session.
    function bless(
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
        _requireNonEmptyCID(cid);

        UserUsage storage u = usage[sessionId][msg.sender];
        _requireBlessCapacity(msg.sender, sessionId, u);

        unchecked { u.blessingsMade += 1; }
        _addMessageInternal(s, messageId, msg.sender, cid, /*isBlessing*/ true);
    }

    /** @notice Praise any existing message (requires capacity in THIS session). */
    function praise(
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

        UserUsage storage u = usage[sessionId][msg.sender];
        _requirePraiseCapacity(msg.sender, sessionId, u);

        unchecked {
            u.praisesMade += 1;
            m.praiseCount += 1;
            s.totalPraises += 1;
        }

        emit Praised(sessionId, messageId, msg.sender);
    }

    /*──────────────────────── batch (users) ───────────────────*/

    /// @notice Batch praise multiple messages in the same session.
    function batchPraise(
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

        UserUsage storage u = usage[sessionId][msg.sender];
        _requirePraiseBatchCapacity(msg.sender, sessionId, u, n);

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

    /// @notice Batch bless multiple new messages (user-authored) in the same session.
    function batchBless(
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
            _requireNonEmptyCID(cids[i]);
        }

        UserUsage storage u = usage[sessionId][msg.sender];
        _requireBlessBatchCapacity(msg.sender, sessionId, u, n);

        for (uint256 i = 0; i < n; i++) {
            string calldata mid = messageIds[i];
            _addMessageInternal(s, mid, msg.sender, cids[i], /*isBlessing*/ true);
            unchecked { ++u.blessingsMade; }
        }
    }

    /*────────────── batch (owner, single-session) ─────────────*/

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
            _requireNonEmptyCID(it.cid);

            _addMessageInternal(s, it.messageId, msg.sender, it.cid, /*isBlessing*/ false);
        }

        if (s.closed != closedAfter) {
            s.closed = closedAfter;
            if (closedAfter) {
                emit SessionClosed(sessionId);
            } else {
                emit SessionReopened(sessionId);
            }
        }
    }

    /*────────────── batch (owner, cross-session) ─────────────*/

    function abrahamBatchCreate(CreateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            CreateItem calldata it = items[i];

            require(bytes(sessions[it.sessionId].id).length == 0, "Session exists");
            require(bytes(messages[it.sessionId][it.firstMessageId].id).length == 0, "Message exists");
            _requireNonEmptyCID(it.cid);

            Session storage s = sessions[it.sessionId];
            s.id = it.sessionId;
            s.closed = false;
            s.messageCount = 0;
            s.totalBlessings = 0;
            s.totalPraises = 0;

            _addMessageInternal(s, it.firstMessageId, msg.sender, it.cid, /*isBlessing*/ false);

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
            _requireNonEmptyCID(it.cid);

            Session storage s = sessions[it.sessionId];

            _addMessageInternal(s, it.messageId, msg.sender, it.cid, /*isBlessing*/ false);

            if (s.closed != it.closed) {
                s.closed = it.closed;
                if (it.closed) {
                    emit SessionClosed(it.sessionId);
                } else {
                    emit SessionReopened(it.sessionId);
                }
            }
        }
    }

    /*──────────────────────── view helpers ────────────────────*/

    function getMessage(
        string calldata sessionId,
        string calldata messageId
    )
        external
        view
        returns (
            address author,
            string memory cid,
            uint256 praiseCount
        )
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
        external
        view
        returns (uint256 messageCount, uint256 totalBlessings, uint256 totalPraises, bool closed)
    {
        Session storage s = sessions[sessionId];
        require(bytes(s.id).length != 0, "Session not found");
        return (s.messageCount, s.totalBlessings, s.totalPraises, s.closed);
    }

    function getUserUsage(string calldata sessionId, address user)
        external
        view
        returns (uint64 praisesMade_, uint64 blessingsMade_)
    {
        UserUsage storage u = usage[sessionId][user];
        return (u.praisesMade, u.blessingsMade);
    }

    /*──────────────────────── admin ───────────────────────────*/

    function setRequirements(uint256 newPraiseRequirement, uint256 newBlessRequirement) external onlyOwner {
        require(newPraiseRequirement > 0 && newBlessRequirement > 0, "invalid req");
        praiseRequirement = newPraiseRequirement;
        blessRequirement = newBlessRequirement;
    }

    /*──────────────────────── internal ───────────────────────*/

    function _addMessageInternal(
        Session storage s,
        string memory messageId,
        address author,
        string memory cid,
        bool isBlessing
    ) private {
        messages[s.id][messageId] = Message({
            id: messageId,
            author: author,
            cid: cid,
            praiseCount: 0
        });

        s.messageIds.push(messageId);
        unchecked {
            ++s.messageCount;
            if (isBlessing) ++s.totalBlessings;
        }

        emit MessageAdded(s.id, messageId, author, cid);
    }

    function _abrahamUpdateInternal(
        Session storage s,
        string memory messageId,
        string memory cid,
        bool closed
    ) private {
        _addMessageInternal(s, messageId, msg.sender, cid, /*isBlessing*/ false);

        if (s.closed != closed) {
            s.closed = closed;
            if (closed) {
                emit SessionClosed(s.id);
            } else {
                emit SessionReopened(s.id);
            }
        }
    }

    function _requireNonEmptyCID(string calldata cid) private pure {
        require(bytes(cid).length > 0, "CID required");
    }

    /*──────── capacity logic (per-user per-session) ────────*/

    function _requirePraiseCapacity(address user, string calldata sessionId, UserUsage storage u) private view {
        uint256 stake = stakingContract.stakedBalance(user, sessionId);
        uint256 p = uint256(u.praisesMade) + 1;
        uint256 b = uint256(u.blessingsMade);
        uint256 requiredStake = p * praiseRequirement + b * blessRequirement;
        require(stake >= requiredStake, "insufficient stake for praise");
    }

    function _requireBlessCapacity(address user, string calldata sessionId, UserUsage storage u) private view {
        uint256 stake = stakingContract.stakedBalance(user, sessionId);
        uint256 p = uint256(u.praisesMade);
        uint256 b = uint256(u.blessingsMade) + 1;
        uint256 requiredStake = p * praiseRequirement + b * blessRequirement;
        require(stake >= requiredStake, "insufficient stake for bless");
    }

    function _requirePraiseBatchCapacity(
        address user,
        string calldata sessionId,
        UserUsage storage u,
        uint256 additionalPraises
    ) private view {
        uint256 stake = stakingContract.stakedBalance(user, sessionId);
        uint256 p = uint256(u.praisesMade) + additionalPraises;
        uint256 b = uint256(u.blessingsMade);
        uint256 requiredStake = p * praiseRequirement + b * blessRequirement;
        require(stake >= requiredStake, "insufficient stake for batch praise");
    }

    function _requireBlessBatchCapacity(
        address user,
        string calldata sessionId,
        UserUsage storage u,
        uint256 additionalBlessings
    ) private view {
        uint256 stake = stakingContract.stakedBalance(user, sessionId);
        uint256 p = uint256(u.praisesMade);
        uint256 b = uint256(u.blessingsMade) + additionalBlessings;
        uint256 requiredStake = p * praiseRequirement + b * blessRequirement;
        require(stake >= requiredStake, "insufficient stake for batch bless");
    }

    /*fallback / receive (not used, but harmless) */
    receive() external payable {}
    fallback() external payable {}
}
