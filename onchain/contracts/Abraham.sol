// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract Abraham is Ownable, ReentrancyGuard {
    constructor() Ownable(msg.sender) ReentrancyGuard() {}

    uint256 public constant PRAISE_PRICE = 10_000_000_000_000; // 0.00001 ETH
    uint256 public constant BLESS_PRICE  = 20_000_000_000_000; // 0.00002 ETH

    struct Message {
        address   author;      // msg.sender
        string    content;     // UTF-8 text
        string    media;       // IPFS hash (empty unless author == owner)
        address[] praisers;    // unique addresses that paid PRAISE_PRICE
    }

    struct Session {
        uint256 id;            // sessionId == index in [1, …]
        uint256 messageCount;  // total Messages so far
    }

    uint256 public sessionCount;                        // total Sessions
    mapping(uint256 => Session) public sessions;        // sessionId → Session
    mapping(uint256 => mapping(uint256 => Message)) private _messages; // sessionId → msgIdx → Message
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private _hasPraised; // sessionId → msgIdx → user → true

   
    event SessionCreated(uint256 indexed sessionId);
    event MessageAdded(
        uint256 indexed sessionId,
        uint256 indexed messageIndex,
        address indexed author,
        string  content,
        string  media
    );
    event Praised(
        uint256 indexed sessionId,
        uint256 indexed messageIndex,
        address indexed praiser
    );



    /// @dev Abraham starts a new Creation / Session with an image & text.
    function createSession(string calldata content, string calldata media)
        external
        onlyOwner
    {
        require(bytes(media).length > 0, "Media required for first message");

        ++sessionCount;
        sessions[sessionCount] = Session({ id: sessionCount, messageCount: 0 });

        _addMessage(sessionCount, _msgSender(), content, media); // emits events
        emit SessionCreated(sessionCount);
    }

    /// @dev Abraham appends another image + text to an existing Session.
    function abrahamUpdate(
        uint256 sessionId,
        string calldata content,
        string calldata media
    ) external onlyOwner {
        require(_sessionExists(sessionId), "Session not found");
        require(bytes(media).length > 0, "Media required");
        _addMessage(sessionId, _msgSender(), content, media);
    }

    /// @dev Any user leaves a text-only blessing (cost: BLESS_PRICE).
    function bless(uint256 sessionId, string calldata content)
        external
        payable
        nonReentrant
    {
        require(_sessionExists(sessionId), "Session not found");
        require(bytes(content).length > 0, "Content required");
        require(msg.value == BLESS_PRICE, "Incorrect ETH for blessing");

        _addMessage(sessionId, _msgSender(), content, ""); // no media
    }

    /// @dev Praise (like) any Message once (cost: PRAISE_PRICE).
    function praise(uint256 sessionId, uint256 messageIndex)
        external
        payable
        nonReentrant
    {
        require(_sessionExists(sessionId),      "Session not found");
        require(messageIndex < sessions[sessionId].messageCount, "Message not found");
        require(msg.value == PRAISE_PRICE,      "Incorrect ETH for praise");
        require(!_hasPraised[sessionId][messageIndex][_msgSender()], "Already praised");

        Message storage m = _messages[sessionId][messageIndex];
        _hasPraised[sessionId][messageIndex][_msgSender()] = true;
        m.praisers.push(_msgSender());

        emit Praised(sessionId, messageIndex, _msgSender());
    }

    /*──────────────────────────────────────────────────────────
                              VIEW HELPERS
    ──────────────────────────────────────────────────────────*/

    /// @return total messages in a Session.
    function getMessageCount(uint256 sessionId) external view returns (uint256) {
        require(_sessionExists(sessionId), "Session not found");
        return sessions[sessionId].messageCount;
    }

  
    function getMessage(uint256 sessionId, uint256 messageIndex)
        external
        view
        returns (
            address author,
            string memory content,
            string memory media,
            uint256 praiseCount
        )
    {
        require(_sessionExists(sessionId), "Session not found");
        require(messageIndex < sessions[sessionId].messageCount, "Message not found");

        Message storage m = _messages[sessionId][messageIndex];
        return (m.author, m.content, m.media, m.praisers.length);
    }

    /// @return all praiser addresses for a given Message.
    function getPraisers(uint256 sessionId, uint256 messageIndex)
        external
        view
        returns (address[] memory)
    {
        require(_sessionExists(sessionId), "Session not found");
        require(messageIndex < sessions[sessionId].messageCount, "Message not found");
        return _messages[sessionId][messageIndex].praisers;
    }



    /// @dev Withdraw accumulated ETH to owner.
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    function _addMessage(
        uint256 sessionId,
        address author,
        string calldata content,
        string memory media
    ) internal {
        Session storage s = sessions[sessionId];
        uint256 idx      = s.messageCount;

        _messages[sessionId][idx].author  = author;
        _messages[sessionId][idx].content = content;
        _messages[sessionId][idx].media   = media;

        unchecked { ++s.messageCount; }

        emit MessageAdded(sessionId, idx, author, content, media);
    }

    function _sessionExists(uint256 sessionId) private view returns (bool) {
        return sessionId != 0 && sessionId <= sessionCount;
    }

    receive() external payable {}
    fallback() external payable {}
}
