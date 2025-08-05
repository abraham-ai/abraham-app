// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Abraham is Ownable, ReentrancyGuard {
    constructor() Ownable(msg.sender) ReentrancyGuard() {}

    /*──────────────────────── constants ───────────────────────*/
    uint256 public constant PRAISE_PRICE = 10_000_000_000_000; // 0.00001 ETH
    uint256 public constant BLESS_PRICE  = 20_000_000_000_000; // 0.00002 ETH

    /*──────────────────────── structs ─────────────────────────*/
    struct Message {
        string   id;          // uuid
        address  author;
        string   content;
        string   media;       // may be empty
        address[] praisers;   // duplicates allowed
    }

    struct Session {
        string   id;               // uuid
        string[] messageIds;       // ordering
        uint256  messageCount;
        bool     closed;           // true ⇢ no praises / blessings
    }

    // For owner batch inside a single session (kept from previous version)
    struct OwnerMsg {
        string messageId;
        string content;  // may be ""
        string media;    // may be ""
    }

    // NEW: cross-session batch create
    struct CreateItem {
        string sessionId;
        string firstMessageId;
        string content;           // may be ""
        string media;             // may be ""
    }

    // NEW: cross-session batch update (one update per target session)
    struct UpdateItem {
        string sessionId;
        string messageId;
        string content;           // may be ""
        string media;             // may be ""
    }

    /*──────────────────────── storage ─────────────────────────*/
    mapping(string => Session) private sessions;                        // sessionId → Session
    mapping(string => mapping(string => Message)) private messages;     // sessionId → messageId → Message

    uint256 public sessionTotal; // analytics

    /*──────────────────────── events ──────────────────────────*/
    event SessionCreated(string sessionId);
    event SessionClosed(string sessionId);
    event SessionReopened(string sessionId);
    event MessageAdded(string sessionId, string messageId, address author, string content, string media);
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

    /// @notice Create a new session with its first message (content and/or media).
    function createSession(
        string calldata sessionId,
        string calldata firstMessageId,
        string calldata content,
        string calldata media
    )
        external
        onlyOwner
        uniqueSession(sessionId)
        uniqueMessage(sessionId, firstMessageId)
    {
        _requireSomePayload(content, media);

        // initialise session
        Session storage s = sessions[sessionId];
        s.id           = sessionId;
        s.closed       = false;
        s.messageCount = 0;

        _addMessageInternal(s, firstMessageId, msg.sender, content, media);

        unchecked { ++sessionTotal; }
        emit SessionCreated(sessionId);
    }

    /// @notice Overload: create a new session with content only (no media).
    function createSession(
        string calldata sessionId,
        string calldata firstMessageId,
        string calldata content
    )
        external
        onlyOwner
        uniqueSession(sessionId)
        uniqueMessage(sessionId, firstMessageId)
    {
        require(bytes(content).length > 0, "Content required");

        // initialise session
        Session storage s = sessions[sessionId];
        s.id           = sessionId;
        s.closed       = false;
        s.messageCount = 0;

        _addMessageInternal(s, firstMessageId, msg.sender, content, "");

        unchecked { ++sessionTotal; }
        emit SessionCreated(sessionId);
    }

    /**
     * @notice Abraham adds a message (with media or without) and can close/reopen the session.
     * @param closed Desired session state after this call.
     */
    function abrahamUpdate(
        string calldata sessionId,
        string calldata messageId,
        string calldata content,
        string calldata media,
        bool   closed
    )
        external
        onlyOwner
        sessionExists(sessionId)
        uniqueMessage(sessionId, messageId)
    {
        _requireSomePayload(content, media);

        Session storage s = sessions[sessionId];
        _abrahamUpdateInternal(s, messageId, content, media, closed);
    }

    /// @notice Overload: Abraham adds a content-only message (no media) and can close/reopen the session.
    function abrahamUpdate(
        string calldata sessionId,
        string calldata messageId,
        string calldata content,
        bool   closed
    )
        external
        onlyOwner
        sessionExists(sessionId)
        uniqueMessage(sessionId, messageId)
    {
        require(bytes(content).length > 0, "Content required");

        Session storage s = sessions[sessionId];
        _abrahamUpdateInternal(s, messageId, content, "", closed);
    }

    /// @notice Any user adds a text-only blessing (pays BLESS_PRICE).
    function bless(
        string calldata sessionId,
        string calldata messageId,
        string calldata content
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
        require(bytes(content).length > 0, "Content required");

        _addMessageInternal(s, messageId, msg.sender, content, "");
    }

    /**
     * @notice Praise any message. Users can praise as many times as they like (each costs PRAISE_PRICE).
     */
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

        m.praisers.push(msg.sender);           // duplicates allowed
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
            m.praisers.push(msg.sender);
            emit Praised(sessionId, messageIds[i], msg.sender);
        }
    }

    /// @notice Batch bless multiple text-only messages in the same session (payer provides total ETH).
    function batchBless(
        string calldata sessionId,
        string[] calldata messageIds,
        string[] calldata contents
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
        require(n == contents.length, "Length mismatch");
        require(msg.value == BLESS_PRICE * n, "Incorrect ETH");

        for (uint256 i = 0; i < n; i++) {
            string calldata mid = messageIds[i];
            require(bytes(messages[sessionId][mid].id).length == 0, "Message exists");
            string calldata content = contents[i];
            require(bytes(content).length > 0, "Content required");
            _addMessageInternal(s, mid, msg.sender, content, "");
        }
    }

    /*────────────── batch (owner, single-session kept) ─────────────*/

    /// @notice Owner posts many messages (content and/or media) to ONE session, then optionally toggles closed state.
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
            _requireSomePayload(it.content, it.media);
            _addMessageInternal(s, it.messageId, msg.sender, it.content, it.media);
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

    /*────────────── NEW: batch (owner, cross-session) ─────────────*/

    /// @notice Create MANY sessions at once. Each item produces SessionCreated + first MessageAdded.
    function abrahamBatchCreate(CreateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            CreateItem calldata it = items[i];

            // Unique session + first message
            require(bytes(sessions[it.sessionId].id).length == 0, "Session exists");
            require(bytes(messages[it.sessionId][it.firstMessageId].id).length == 0, "Message exists");

            _requireSomePayload(it.content, it.media);

            // init session
            Session storage s = sessions[it.sessionId];
            s.id           = it.sessionId;
            s.closed       = false;
            s.messageCount = 0;

            _addMessageInternal(s, it.firstMessageId, msg.sender, it.content, it.media);

            unchecked { ++sessionTotal; }
            emit SessionCreated(it.sessionId);
        }
    }

    /// @notice Post one owner message to EACH target session in a single tx.
    ///         This does NOT change session closed state (use single-session update for that).
    function abrahamBatchUpdateAcrossSessions(UpdateItem[] calldata items) external onlyOwner {
        uint256 n = items.length;
        require(n > 0, "No items");

        for (uint256 i = 0; i < n; i++) {
            UpdateItem calldata it = items[i];

            // Session must exist; message must be unique per that session
            require(bytes(sessions[it.sessionId].id).length != 0, "Session not found");
            require(bytes(messages[it.sessionId][it.messageId].id).length == 0, "Message exists");

            _requireSomePayload(it.content, it.media);

            Session storage s = sessions[it.sessionId];
            // does not toggle closed/open; just adds a message
            _addMessageInternal(s, it.messageId, msg.sender, it.content, it.media);
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
            address   author,
            string memory content,
            string memory media,
            uint256   praiseCount
        )
    {
        Message storage m = messages[sessionId][messageId];
        return (m.author, m.content, m.media, m.praisers.length);
    }

    function getMessageIds(string calldata sessionId)
        external
        view
        returns (string[] memory)
    {
        return sessions[sessionId].messageIds;
    }

    function isSessionClosed(string calldata sessionId)
        external
        view
        returns (bool)
    {
        return sessions[sessionId].closed;
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
        string memory content,
        string memory media
    ) private {
        messages[s.id][messageId] = Message({
            id:       messageId,
            author:   author,
            content:  content,
            media:    media,               // may be empty
            praisers: new address[](0)
        });

        s.messageIds.push(messageId);
        unchecked { ++s.messageCount; }

        emit MessageAdded(s.id, messageId, author, content, media);
    }

    function _abrahamUpdateInternal(
        Session storage s,
        string memory messageId,
        string memory content,
        string memory media,
        bool closed
    ) private {
        _addMessageInternal(s, messageId, msg.sender, content, media);

        if (s.closed != closed) {
            s.closed = closed;
            if (closed) {
                emit SessionClosed(s.id);
            } else {
                emit SessionReopened(s.id);
            }
        }
    }

    function _requireSomePayload(string calldata content, string calldata media) private pure {
        require(
            bytes(content).length > 0 || bytes(media).length > 0,
            "Empty message"
        );
    }

    /*fallback / receive */
    receive() external payable {}
    fallback() external payable {}
}
