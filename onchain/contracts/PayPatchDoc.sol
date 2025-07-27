// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SystemPromptPayPatch {
    /* ───────── pricing & ownership ───────── */
    uint256 public pricePerByte = 1e13;               // 0.00001 ETH
    address public immutable owner;
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }

    /* ───────── versioned storage ─────────── */
    uint256 public latestVersion;                     // starts at 0
    mapping(uint256 => address) private _blobOf;      // version ⇒ blob ptr

    /* ───────── op‑codes ───────────────────── */
    uint8 private constant OP_KEEP   = 0x00;
    uint8 private constant OP_DELETE = 0x01;
    uint8 private constant OP_INSERT = 0x02;

    /* ───────── events ─────────────────────── */
    event Patched(
        uint256 indexed version,
        address indexed editor,
        uint256 bytesChanged,
        uint256 weiCharged,
        uint256 newLength,
        bytes32 contentHash
    );
    event PriceChanged(uint256 newWei);

    /* ───────── ctor ───────────────────────── */
    constructor(string memory initialText) {
        owner         = msg.sender;
        _blobOf[0]    = _blobWrite(bytes(initialText));
        latestVersion = 0;
    }

    /* ───────── public views ───────────────── */
    function text() public view returns (string memory) {
        return string(_blobRead(_blobOf[latestVersion]));
    }
    function textAt(uint256 v) external view returns (string memory) {
        require(v <= latestVersion, "no such version");
        return string(_blobRead(_blobOf[v]));
    }

    /* ───────── admin ──────────────────────── */
    function setPrice(uint256 newWei) external onlyOwner {
        pricePerByte = newWei; emit PriceChanged(newWei);
    }
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        to.transfer(amount == 0 ? address(this).balance : amount);
    }

    /* ───────── main entry: patch + pay ───── */
    function applyPatch(bytes calldata ops) external payable {
        bytes memory old = _blobRead(_blobOf[latestVersion]);

        uint256 src=0; uint256 op=0; uint256 dst=0; uint256 changed=0;
        bytes memory buf = new bytes(old.length + ops.length);

        while (op < ops.length) {
            require(op + 3 <= ops.length, "trunc op");
            uint8 code = uint8(ops[op]);
            uint16 n   = (uint16(uint8(ops[op+1]))<<8)|uint8(ops[op+2]);
            op += 3;

            if (code == OP_KEEP) {
                require(src + n <= old.length, "KEEP OOB");
                _cpy(old, src, buf, dst, n); src += n; dst += n;
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
        assembly { mstore(buf, dst) }                           // shrink

        uint256 due = changed * pricePerByte;
        require(msg.value >= due, "under-pay");

        address ptr             = _blobWrite(buf);
        uint256 v               = ++latestVersion;
        _blobOf[v]              = ptr;
        if (msg.value > due) payable(msg.sender).transfer(msg.value - due);

        emit Patched(v, msg.sender, changed, due, dst, keccak256(buf));
    }

    /* ───────── blob helpers ───────────────── */
    function _blobWrite(bytes memory data) internal returns (address ptr) {
        bytes memory code = abi.encodePacked(hex"00", data);
        assembly { ptr := create(0, add(code, 32), mload(code)) }
        require(ptr != address(0), "blob fail");
    }
    function _blobRead(address ptr) internal view returns (bytes memory d) {
        uint256 len; assembly { len := sub(extcodesize(ptr), 1) }
        d = new bytes(len);
        assembly { extcodecopy(ptr, add(d,32), 1, len) }
    }

    /* ───────── mem‑copy helpers ───────────── */
    function _cpy(bytes memory s,uint256 si,bytes memory d,uint256 di,uint256 n) private pure {
        for (uint256 i; i<n; ++i) d[di+i] = s[si+i];
    }
    function _cpyCalldata(bytes calldata s,uint256 si,bytes memory d,uint256 di,uint256 n) private pure {
        for (uint256 i; i<n; ++i) d[di+i] = s[si+i];
    }

    receive() external payable {}
}
