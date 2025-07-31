// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.24;

/**
 *  SystemPromptPayPatch – simple pay‑per‑byte editable document
 *  ------------------------------------------------------------
 *  • Stores every version in a `string[] _versions` array.
 *  • `applyPatch()` uses the 3‑byte KEEP / DELETE / INSERT format.
 *  • Each patch must prepay `changedBytes × pricePerByte`.
 *  • No “blob” trick, no inner create call → easier to reason about.
 */
contract SystemPromptPayPatch {
    /* ─── pricing & ownership ───────────────────────────── */
    uint256 public pricePerByte = 1e13;          // 0.00001 ETH
    address public immutable owner;
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }

    /* ─── versioned storage ─────────────────────────────── */
    string[] private _versions;                  // v0 after deploy
    uint256  public latestVersion;

    /* ─── op‑codes ──────────────────────────────────────── */
    uint8 private constant OP_KEEP   = 0x00;
    uint8 private constant OP_DELETE = 0x01;
    uint8 private constant OP_INSERT = 0x02;

    /* ─── events ────────────────────────────────────────── */
    event Patched(
        uint256 indexed version,
        address indexed editor,
        uint256 bytesChanged,
        uint256 weiCharged,
        uint256 newLength,
        bytes32 contentHash
    );
    event PriceChanged(uint256 newWei);

    /* ─── constructor ───────────────────────────────────── */
    constructor(string memory initialText) {
        owner          = msg.sender;
        _versions.push(initialText);             // v0
        latestVersion  = 0;
    }

    /* ─── public views ─────────────────────────────────── */
    function text() public view returns (string memory) {
        return _versions[latestVersion];
    }
    function textAt(uint256 v) external view returns (string memory) {
        require(v <= latestVersion, "no such version");
        return _versions[v];
    }

    /* ─── admin helpers ────────────────────────────────── */
    function setPrice(uint256 weiPerByte) external onlyOwner {
        pricePerByte = weiPerByte;
        emit PriceChanged(weiPerByte);
    }
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    /* ─── main entry: patch + pay ───────────────────────── */
    function applyPatch(bytes calldata ops) external payable {
        bytes memory old = bytes(_versions[latestVersion]);

        uint256 src = 0;                       // cursor in old
        uint256 op  = 0;                       // cursor in ops
        uint256 dst = 0;                       // cursor in buf
        uint256 changed = 0;                   // bytes inserted+deleted

        bytes memory buf = new bytes(old.length + ops.length);

        while (op < ops.length) {
            require(op + 3 <= ops.length, "truncated op");
            uint8  code = uint8(ops[op]);
            uint16 n    = (uint16(uint8(ops[op+1])) << 8) | uint8(ops[op+2]);
            op += 3;

            if (code == OP_KEEP) {
                require(src + n <= old.length, "KEEP OOB");
                _cpy(old, src, buf, dst, n);  src += n; dst += n;
            } else if (code == OP_DELETE) {
                require(src + n <= old.length, "DEL OOB");
                src += n; changed += n;
            } else if (code == OP_INSERT) {
                require(op + n <= ops.length, "INS OOB");
                _cpyCalldata(ops, op, buf, dst, n);
                op += n; dst += n; changed += n;
            } else revert("bad op");
        }
        require(src == old.length, "patch underruns");

        assembly { mstore(buf, dst) }          // shrink buffer

        uint256 due = changed * pricePerByte;
        require(msg.value >= due, "under pay");

        string memory newText = string(buf);
        _versions.push(newText);
        latestVersion = _versions.length - 1;

        if (msg.value > due) payable(msg.sender).transfer(msg.value - due);

        emit Patched(
            latestVersion,
            msg.sender,
            changed,
            due,
            dst,
            keccak256(buf)
        );
    }

    /* ─── tiny mem‑copy helpers ────────────────────────── */
    function _cpy(
        bytes memory s, uint256 si,
        bytes memory d, uint256 di,
        uint256 n
    ) private pure { for (uint256 i; i < n; ++i) d[di+i] = s[si+i]; }

    function _cpyCalldata(
        bytes calldata s, uint256 si,
        bytes memory   d, uint256 di,
        uint256 n
    ) private pure { for (uint256 i; i < n; ++i) d[di+i] = s[si+i]; }

    /* ─── receive accidental ETH / tips ────────────────── */
    receive() external payable {}
}
