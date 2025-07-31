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
        string   media;       // empty for blessings
        address[] praisers;
    }

    struct Session {
        string   id;               // uuid
        string[] messageIds;       // ordering
        uint256  messageCount;
        bool     closed;           // ⇦ NEW: true ⇢ no praises / blessings
    }

    /*──────────────────────── storage ─────────────────────────*/
    mapping(string => Session) private sessions;    // sessionId → Session
    mapping(string => mapping(string => Message)) private messages; // sessionId → messageId → Message

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

    /// @notice Create a new session with its first (image + text) message.
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
        require(bytes(media).length > 0, "Media required");

        // initialise session
        Session storage s = sessions[sessionId];
        s.id       = sessionId;
        s.closed   = false;
        s.messageCount = 0;

        _addMessageInternal(s, firstMessageId, msg.sender, content, media);

        unchecked { ++sessionTotal; }
        emit SessionCreated(sessionId);
    }

    /**
     * @notice Abraham adds another image + text message
     *         **and** (optionally) closes / reopens the session.
     * @param closed Desired session state after this call.
     */
    function abrahamUpdate(
        string calldata sessionId,
        string calldata messageId,
        string calldata content,
        string calldata media,
        bool   closed              // ⇦ NEW PARAM
    )
        external
        onlyOwner
        sessionExists(sessionId)
        uniqueMessage(sessionId, messageId)
    {
        require(bytes(media).length > 0, "Media required");

        Session storage s = sessions[sessionId];
        _addMessageInternal(s, messageId, msg.sender, content, media);

        // handle (re-)opening / closing
        if (s.closed != closed) {
            s.closed = closed;
            if (closed) {
                emit SessionClosed(sessionId);
            } else {
                emit SessionReopened(sessionId);
            }
        }
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
     * @notice Praise any message.  
     *         Users can praise **as many times as they like** (each costs PRAISE_PRICE).
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
            media:    media,
            praisers: new address[](0)
        });

        s.messageIds.push(messageId);
        unchecked { ++s.messageCount; }

        emit MessageAdded(s.id, messageId, author, content, media);
    }

    /*fallback / receive */
    receive() external payable {}
    fallback() external payable {}
}
