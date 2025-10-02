// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* Minimal token interface for returning staked tokens on unstake */
interface IAbrahamTokenLite {
    function transfer(address to, uint256 amount) external returns (bool);
}

/* Receiver hook for ERC-677-like tokens */
interface ITokenReceiver {
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool);
}

/**
 * @title AbrahamStaking
 * @notice Per-session staking with time-weighted "curation points".
 *         Users deposit by sending tokens with transferAndCall to this contract.
 *         Data must be abi.encode(string sessionId).
 */
contract AbrahamStaking is ITokenReceiver {
    IAbrahamTokenLite public immutable token;

    struct StakeInfo {
        uint256 amount;        // current staked for this session
        uint256 lastUpdate;    // last timestamp points were updated
        uint256 pointsAccrued; // amount * time (token-wei-seconds)
    }

    // user => sessionId => stake info
    mapping(address => mapping(string => StakeInfo)) private stakes;

    event Staked(address indexed user, string indexed sessionId, uint256 amount);
    event Unstaked(address indexed user, string indexed sessionId, uint256 amount);

    constructor(address token_) {
        require(token_ != address(0), "token=0");
        token = IAbrahamTokenLite(token_);
    }

    /* --------------------------- Deposit via hook --------------------------- */

    /**
     * @dev Called by the token contract during transferAndCall.
     * @param from   Original token sender.
     * @param amount Amount of tokens received.
     * @param data   ABI-encoded (string sessionId).
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external override returns (bool) {
        require(msg.sender == address(token), "only token");
        require(amount > 0, "amount=0");

        // Decode sessionId from data
        string memory sessionId = abi.decode(data, (string));

        StakeInfo storage s = stakes[from][sessionId];
        _accrue(s);
        s.amount += amount;
        s.lastUpdate = block.timestamp;

        emit Staked(from, sessionId, amount);
        return true;
    }

    /* ------------------------------ Unstake ------------------------------- */

    function unstake(string calldata sessionId, uint256 amount) external {
        StakeInfo storage s = stakes[msg.sender][sessionId];
        require(amount > 0, "amount=0");
        require(s.amount >= amount, "insufficient stake");

        _accrue(s);
        s.amount -= amount;
        s.lastUpdate = block.timestamp;

        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Unstaked(msg.sender, sessionId, amount);
    }

    /* -------------------------------- Views -------------------------------- */

    function stakedBalance(address user, string calldata sessionId) external view returns (uint256) {
        return stakes[user][sessionId].amount;
    }

    function currentPoints(address user, string calldata sessionId) external view returns (uint256) {
        StakeInfo storage s = stakes[user][sessionId];
        if (s.lastUpdate == 0) return 0;
        return s.pointsAccrued + (s.amount * (block.timestamp - s.lastUpdate));
    }

    function lastUpdateAt(address user, string calldata sessionId) external view returns (uint256) {
        return stakes[user][sessionId].lastUpdate;
    }

    /* ----------------------------- Internals ------------------------------- */

    function _accrue(StakeInfo storage s) private {
        if (s.lastUpdate == 0) {
            s.lastUpdate = block.timestamp;
            return;
        }
        if (s.amount > 0) {
            s.pointsAccrued += s.amount * (block.timestamp - s.lastUpdate);
        }
    }
}
