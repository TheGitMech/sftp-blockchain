// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileRegistry {
    struct File {
        string fileName;
        string fileHash;
        address uploader;
        uint256 timestamp;
    }

    File[] public files;

    event FileAdded(uint256 fileId, string fileName, string fileHash, address uploader, uint256 timestamp);

    function addFile(string memory fileName, string memory fileHash) public {
        files.push(File(fileName, fileHash, msg.sender, block.timestamp));
        emit FileAdded(files.length - 1, fileName, fileHash, msg.sender, block.timestamp);
    }

    function getFilesCount() public view returns (uint256) {
        return files.length;
    }
}
