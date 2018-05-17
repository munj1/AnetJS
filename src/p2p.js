const WebSockets = require("ws"),
    Blockchain = require("./blockchain");


const { replaceChain, addBlockToChain, getNewestBlock, isBlockStructureValid } = Blockchain;

const sockets = [];

//Message TYPES
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";

//Message Creators
const getLatest = () => {
    return {
        type: GET_LATEST,
        data: null
    };
};

const getAll = () => {
    return {
        type: GET_ALL,
        data: null
    };
};

const blockchainResponse = () => {
    return {
        type: BLOCKCHAIN_RESPONSE,
        data
    };
};


const getSockets = () => sockets;

const startP2PServer = server => {
    const wsServer = new WebSockets.Server({ server });
    wsServer.on("connection", ws => {
        initSocketConnection(ws);
    });
    console.log('P2P Server Running');
};

const initSocketConnection = ws => {
    sockets.push(ws);
    handleSocketMessages(ws);
    handleSocketError(ws);
    sendMessage(ws, getLatest());
};

const parseData = data => {
    try {
        return JSON.parse(data);
    } catch(e) {
        console.log(e);
        return null;
    }
};

const handleSocketMessages = ws => {
    ws.on("message", data => {
        const message = parseData(data);
        if(message === null) {
            return;
        }
        console.log(message);
        switch(message.type) {
            case GET_LATEST:
                sendMessage(ws, responseLatest());
                break;
            case BLOCKCHAIN_RESPONSE:
                const receivedBlocks = message.data;
                if(receivedBlocks === null) {
                    break;
                }
                handleBlockchainResponse(receivedBlocks);
                break;
        }
    });
};

const handleBlockchainResponse = receivedBlocks => {
    if(receivedBlocks.length === 0) {
        console.log("received blocks is empty");
        return;
    }
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    if(!isBlockStructureValid(latestBlockReceived)) {
        console.log("The block structure of the block received is not valid");
        return;
    }
    const newestBlock = getNewestBlock();
    
    // our blockchain is behind the other blockchain
    if(latestBlockReceived.index > newestBlock.index) {
        // only one block behind
        if(newestBlock.hash === latestBlockReceived.previoushash) {
            addBlockToChain(latestBlockReceived);
        } else if(receivedBlocks.length === 1) {
            // you've got GET_LATEST msg and the block is not adjacent
            // need to get all the blocks
            
        } else {
            replaceChain(receivedBlocks);
        }
         
    }
};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const snedMessageToAll = message => sockets.forEach(socket => sendMessage(ws, message));

const responseLatest = () => blockchainResponse([getNewestBlock()]);

const handleSocketError = ws => {
    const closeSockectConnection = ws => {
        ws.close();
        sockets.splice(sockets.indexOf(ws),1);
    };
    ws.on("close", () => closeSockectConnection(ws));
    ws.on("error", () => closeSockectConnection(ws));
    
};

const connectToPeers = newPeer => {
    const ws = new WebSockets(newPeer);
    ws.on("open", () => {
        initSocketConnection(ws);
    });
};

module.exports = {
    startP2PServer,
    connectToPeers
};