// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Abraham: messages live on IPFS as JSON (content + media in one file).
 * On-chain we store only the IPFS CID and counters (praises/blessings).
 */
contract Abraham is Ownable, ReentrancyGuard {
    constructor() Ownable(msg.sender) ReentrancyGuard() {}

    /*──────────────────────── constants ───────────────────────*/
    uint256 public constant PRAISE_PRICE = 10_000_000_000_000; // 0.00001 ETH
    uint256 public constant BLESS_PRICE  = 20_000_000_000_000; // 0.00002 ETH

    /*──────────────────────── structs ─────────────────────────*/
    struct Message {
        string   id;          // uuid (per-session message id)
        address  author;
        string   cid;         // IPFS CID for the JSON blob (content + media)
        uint256  praiseCount; // number of praises
    }

    struct Session {
        string   id;               // uuid
        string[] messageIds;       // ordering
        uint256  messageCount;
        uint256  totalBlessings;   // count of user-authored messages
        uint256  totalPraises;     // sum of praises on all messages
        bool     closed;           // true ⇢ no praises / blessings
    }

    // For owner batch inside a single session
    struct OwnerMsg {
        string messageId;
        string cid; // IPFS CID
    }

    // cross-session batch create (sessions always start open)
    struct CreateItem {
        string sessionId;
        string firstMessageId;
        string cid; // IPFS CID
    }

    // cross-session batch update (one update per target session)
    struct UpdateItem {
        string sessionId;
        string messageId;
        string cid;   // IPFS CID
        bool   closed;  // desired state after posting this message
    }

    /*──────────────────────── storage ─────────────────────────*/
    mapping(string => Session) private sessions;                    // sessionId → Session
    mapping(string => mapping(string => Message)) private messages; // sessionId → messageId → Message
    uint256 public sessionTotal; // analytics

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

        // initialise session (always open)
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

    /// @notice Any user adds a blessing (text-only in your UX, but still an IPFS JSON) and pays BLESS_PRICE.
    function bless(
        string calldata sessionId,
        string calldata messageId,
        string calldata cid
    )
        external
        payable
        nonReentrant
        sessionExists(sessionId)
        uniqueMessage(sessionId, messageId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");
        require(msg.value == BLESS_PRICE, "Incorrect ETH");
        _requireNonEmptyCID(cid);

        _addMessageInternal(s, messageId, msg.sender, cid, /*isBlessing*/ true);
    }

    /** @notice Praise any existing message. Users can praise as many times as they like (each costs PRAISE_PRICE). */
    function praise(
        string calldata sessionId,
        string calldata messageId
    )
        external
        payable
        nonReentrant
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");
        require(msg.value == PRAISE_PRICE, "Incorrect ETH");

        Message storage m = messages[sessionId][messageId];
        require(bytes(m.id).length != 0, "Message not found");

        unchecked {
            m.praiseCount += 1;
            s.totalPraises += 1;
        }

        emit Praised(sessionId, messageId, msg.sender);
    }

    /*──────────────────────── batch (users) ───────────────────*/

    /// @notice Batch praise multiple messages in the same session (payer provides total ETH).
    function batchPraise(
        string calldata sessionId,
        string[] calldata messageIds
    )
        external
        payable
        nonReentrant
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");

        uint256 n = messageIds.length;
        require(n > 0, "No items");
        require(msg.value == PRAISE_PRICE * n, "Incorrect ETH");

        for (uint256 i = 0; i < n; i++) {
            Message storage m = messages[sessionId][messageIds[i]];
            require(bytes(m.id).length != 0, "Message not found");
            unchecked {
                m.praiseCount += 1;
                s.totalPraises += 1;
            }
            emit Praised(sessionId, messageIds[i], msg.sender);
        }
    }

    /// @notice Batch bless multiple messages (user-authored) in the same session.
    function batchBless(
        string calldata sessionId,
        string[] calldata messageIds,
        string[] calldata cids
    )
        external
        payable
        nonReentrant
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(!s.closed, "Session closed");

        uint256 n = messageIds.length;
        require(n > 0, "No items");
        require(n == cids.length, "Length mismatch");
        require(msg.value == BLESS_PRICE * n, "Incorrect ETH");

        for (uint256 i = 0; i < n; i++) {
            string calldata mid = messageIds[i];
            require(bytes(messages[sessionId][mid].id).length == 0, "Message exists");
            _requireNonEmptyCID(cids[i]);

            _addMessageInternal(s, mid, msg.sender, cids[i], /*isBlessing*/ true);
        }
    }

    /*────────────── batch (owner, single-session) ─────────────*/

    /// @notice Owner posts many messages (by CID) to ONE session, then optionally toggles closed state.
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

    /// @notice Create MANY sessions at once. Each item produces SessionCreated + first MessageAdded.
    ///         Sessions ALWAYS start open (closed = false).
    function abrahamBatchCreate(CreateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            CreateItem calldata it = items[i];

            // Unique session + first message
            require(bytes(sessions[it.sessionId].id).length == 0, "Session exists");
            require(bytes(messages[it.sessionId][it.firstMessageId].id).length == 0, "Message exists");
            _requireNonEmptyCID(it.cid);

            // init session (always open)
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

    /// @notice Post one owner message (by CID) to EACH target session in a single tx, and set closed state per item.
    function abrahamBatchUpdateAcrossSessions(UpdateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            UpdateItem calldata it = items[i];

            // Session must exist; message must be unique per that session
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

    /*──────────────────────── admin ───────────────────────────*/
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /*──────────────────────── internal ────────────────────────*/
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

    /*fallback / receive */
    receive() external payable {}
    fallback() external payable {}
}
