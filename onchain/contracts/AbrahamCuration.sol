// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStakingPool {
    struct StakingInfo { uint256 stakedAmount; uint256 lockedUntil; }
    function getStakingInfo(address staker) external view returns (StakingInfo memory stakingInfo);
}

contract AbrahamCuration is Ownable, ReentrancyGuard {
    /* ───────────── External pool ───────────── */
    IStakingPool public stakingPool;
    event StakingPoolUpdated(address indexed previousPool, address indexed newPool);

    /* ───────────── Parameters ───────────── */
    uint256 public stakePerBlessing = 100e18; // 1 bless / 100 staked
    uint256 public periodSeconds    = 5 minutes;
    event BlessingParamsUpdated(uint256 stakePerBlessing, uint256 periodSeconds);

    /* ───────────── Delegation ───────────── */
    mapping(address => mapping(address => bool)) public isDelegateApproved;
    event DelegateApproval(address indexed stakeHolder, address indexed delegate, bool approved);

    function approveDelegate(address delegate, bool approved) external {
        isDelegateApproved[msg.sender][delegate] = approved;
        emit DelegateApproval(msg.sender, delegate, approved);
    }

    /* ───────────── Quota ───────────── */
    struct Quota {
        uint64  lastRefill;
        uint32  balance;
    }
    mapping(address => Quota) private quota;

    /* ───────────── Curation Storage ───────────── */
    mapping(string => uint256) public sessionBlessingCount;
    mapping(string => mapping(string => uint256)) public targetBlessingCount;

    /* ───────────── Blessing Registry ───────────── */
    struct BlessingRecord {
        address actor;
        address stakeHolder;
        string  sessionId;
        string  targetId;
        uint256 timestamp;
    }

    BlessingRecord[] private allBlessings;

    event Blessed(
        string indexed sessionId,
        string indexed targetId,
        address indexed actor,
        address stakeHolder
    );

    constructor(address stakingPool_) Ownable(msg.sender) ReentrancyGuard() {
        require(stakingPool_ != address(0), "staking=0");
        stakingPool = IStakingPool(stakingPool_);
        emit StakingPoolUpdated(address(0), stakingPool_);
        emit BlessingParamsUpdated(stakePerBlessing, periodSeconds);
    }

    /* ───────────── Admin ───────────── */
    function setStakingPool(address newStakingPool) external onlyOwner {
        require(newStakingPool != address(0), "staking=0");
        address old = address(stakingPool);
        stakingPool = IStakingPool(newStakingPool);
        emit StakingPoolUpdated(old, newStakingPool);
    }

    function setBlessingParams(uint256 newStakePerBlessing, uint256 newPeriodSeconds) external onlyOwner {
        require(newStakePerBlessing > 0, "stakePerBlessing=0");
        require(newPeriodSeconds > 0, "period=0");
        stakePerBlessing = newStakePerBlessing;
        periodSeconds    = newPeriodSeconds;
        emit BlessingParamsUpdated(newStakePerBlessing, newPeriodSeconds);
    }

    /* ───────────── Public Blessing ───────────── */
    function bless(
        string calldata sessionId,
        string calldata targetId,
        address stakeHolder
    ) external nonReentrant {
        _consumeCredits(stakeHolder, 1);
        _recordBless(sessionId, targetId, msg.sender, stakeHolder);
    }

    function batchBless(
        string calldata sessionId,
        string[] calldata targetIds,
        address stakeHolder
    ) external nonReentrant {
        uint256 n = targetIds.length;
        require(n > 0, "no-items");
        _consumeCredits(stakeHolder, n);
        for (uint256 i = 0; i < n; i++) {
            _recordBless(sessionId, targetIds[i], msg.sender, stakeHolder);
        }
    }

    /* ───────────── Registry Views ───────────── */

    /// ⚡ Returns all blessings (useful for backend/subgraph sync)
    function getAllBlessings() external view returns (BlessingRecord[] memory) {
        return allBlessings;
    }

    /// Returns total number of blessings made in system
    function totalBlessings() external view returns (uint256) {
        return allBlessings.length;
    }

    /// Filter by actor (who called bless)
    function getBlessingsByActor(address actor) external view returns (BlessingRecord[] memory) {
        uint256 len = allBlessings.length;
        uint256 count;
        for (uint256 i = 0; i < len; i++) {
            if (allBlessings[i].actor == actor) count++;
        }

        BlessingRecord[] memory result = new BlessingRecord[](count);
        uint256 j;
        for (uint256 i = 0; i < len; i++) {
            if (allBlessings[i].actor == actor) {
                result[j++] = allBlessings[i];
            }
        }
        return result;
    }

    /// Filter by sessionId
    function getBlessingsBySession(string calldata sessionId) external view returns (BlessingRecord[] memory) {
        uint256 len = allBlessings.length;
        uint256 count;
        for (uint256 i = 0; i < len; i++) {
            if (keccak256(bytes(allBlessings[i].sessionId)) == keccak256(bytes(sessionId))) count++;
        }

        BlessingRecord[] memory result = new BlessingRecord[](count);
        uint256 j;
        for (uint256 i = 0; i < len; i++) {
            if (keccak256(bytes(allBlessings[i].sessionId)) == keccak256(bytes(sessionId))) {
                result[j++] = allBlessings[i];
            }
        }
        return result;
    }

    /* ───────────── View Utilities ───────────── */

    function stakedBalance(address user) public view returns (uint256) {
        IStakingPool.StakingInfo memory info = stakingPool.getStakingInfo(user);
        return info.stakedAmount;
    }

    function capacityPerPeriod(address stakeHolder) public view returns (uint256) {
        uint256 st = stakedBalance(stakeHolder);
        return st / stakePerBlessing;
    }

    function remainingCredits(address stakeHolder) external view returns (uint256 credits, uint256 capacity) {
        capacity = capacityPerPeriod(stakeHolder);
        Quota memory q = quota[stakeHolder];

        if (capacity == 0) return (0, 0);

        if (q.lastRefill == 0) return (capacity, capacity);

        uint256 periods = (block.timestamp - uint256(q.lastRefill)) / periodSeconds;
        uint256 replenished = q.balance + periods * capacity;
        if (replenished > capacity) replenished = capacity;
        return (replenished, capacity);
    }

    /* ───────────── Internal Logic ───────────── */
    function _recordBless(
        string calldata sessionId,
        string calldata targetId,
        address actor,
        address stakeHolder
    ) private {
        sessionBlessingCount[sessionId] += 1;
        if (bytes(targetId).length != 0) {
            targetBlessingCount[sessionId][targetId] += 1;
        }
        allBlessings.push(BlessingRecord({
            actor: actor,
            stakeHolder: stakeHolder,
            sessionId: sessionId,
            targetId: targetId,
            timestamp: block.timestamp
        }));
        emit Blessed(sessionId, targetId, actor, stakeHolder);
    }

    function _consumeCredits(address stakeHolder, uint256 amount) private {
        require(stakeHolder != address(0), "stakeHolder=0");
        if (stakeHolder != msg.sender) {
            require(isDelegateApproved[stakeHolder][msg.sender], "delegate-not-approved");
        }

        uint256 cap = capacityPerPeriod(stakeHolder);
        require(cap > 0, "no-stake-capacity");

        Quota storage q = quota[stakeHolder];

        // refill
        if (q.lastRefill == 0) {
            q.lastRefill = uint64(block.timestamp);
            q.balance = uint32(_min(cap, type(uint32).max));
        } else {
            uint256 periods = (block.timestamp - uint256(q.lastRefill)) / periodSeconds;
            if (periods > 0) {
                uint256 replenished = uint256(q.balance) + periods * cap;
                if (replenished > cap) replenished = cap;
                q.balance = uint32(_min(replenished, type(uint32).max));
                q.lastRefill = uint64(uint256(q.lastRefill) + periods * periodSeconds);
            }
        }

        require(q.balance >= amount, "insufficient-credits");
        unchecked { q.balance -= uint32(amount); }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    receive() external payable {}
    fallback() external payable {}
}
