const CryptoJS = require("crypto-js"),
    elliptic = require("elliptic"),
    _ = require("lodash");
    utils = require("./utils");

const ec = new elliptic.ec("secp256k1");

const COINBASE_AMOUNT = 50;


class TxOut {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
};

class TxIn {
    // uTxOutId
    // uTxOutIndex
    // Signature
};

class Transaction {
    // ID
    // txIns[]
    // txOuts[]
};

class UTxOut {
    constructor(txOutId, txOutIndex, address, amount) {
        this.TxOutId = txOutId;
        this.TxOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
};


const getTxId = tx => {
    const txInContent = tx.txIns
        .map(txIn => txIn.uTxOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, "");
    const txOutContent = tx.txOuts
        .map(txOut => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, "");
    return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

const findUTxOut = (txOutId, txOutIndex, uTxOutList) => {
    return uTxOutList.find(uTxOut => uTxOut.txOutId === txOutId && uTxOut.txOutIndex === txOutIndex);
};

const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
    const txIn = tx.txIns[txInIndex];
    const dataToSign = tx.id;
    
    const referencedUTxOut = findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList);
    if(referencedUTxOut === null) {
        console.log("Couldnt find the referenced uTxOut, not signing");
        return false;
    }
    const referencedaAddress = referencedUTxOut.address;
    if(getPublicKey(privateKey) !== referencedaAddress) {
        console.log("The referenced address is not matching with the private key");
        return false;
    }
    const key = ec.keyFromPrivate(privateKey, "hex");
    const signature = utils.toHexString(key.sign(dataToSign).toDER());
    return signature;
};

const getPublicKey = (privateKey) => {
    return ec.keyFromPrivate(privateKey, "hex")
    .getPublic()
    .encode("hex");
}

const updateUTxOuts = (newTxs, uTxOutList) => {
    
    // making new TxOut resulting from a new Tx
    const newUTxOuts = newTxs.map(tx => {
        tx.txOuts.map(
            (txOut, index) => {
                new UTxOut(tx.id, index, txOut.address, txOut.amount);
            });
    })
    .reduce((a, b) => a.concat(b), []);

    // emptying the spentTxOut
    const spentTxOuts = newTxs
        .map(tx => tx.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

    // remove the spentTxOut and add the new TxOut
    const resultingUTxOuts = uTxOutList
        .filter(uTxO => !findUTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts))
        .concat(newUTxOuts);
};

const isTxInStructureValid = (txIn) => {
    if(txIn === null) {
        return false;
    } else if(typeof txIn.signature !== "string") {
        return false;
    } else if(typeof txIn.txOutId !== "string") {
        return false;
    } else if(typeof txIn.txOutIndex !== "number") {
        return false;
    } else {
        return true;
    }

}

const isAddressValid = address => {
    if(address.length !== 300) {
        return false;
    } else if(address.match("^[a-fA-F0-9]+$") === null) {
        return false;
    } else if(!address.startsWith("04")) {
        return false;
    } else {
        return true;
    }
};

const isTxOutStructureValid = (txOut) => {
    if(txOut === null) {
        return false;
    } else if(typeof txOut.address !== "string") {
        return false;
    } else if(!isAddressValid(txOut.address)) {
        return false;
    } else if(typeof txOut.amount !== "number") {
        return false;
    } else {
        return true;
    }
};

const isTxStructureValid = (tx) => {
    if(typeof tx.id !== "string") {
        console.log("Tx Id is not valid");
        return false;
    } else if(!(tx.txIns instanceof Array)) {
        console.log("txIns are not an array");
        return false;
    } else if(!tx.txIns.map(isTxInStructureValid).reduce((a, b) => a && b, true)) {
        console.log("structure of one of the txIns is not valid");
        return false;
    } else if(!(tx.txOuts instanceof Array)) {
        console.log("txOuts are not an array");
        return false;
    } else if(!tx.txOuts.map(isTxOutStructureValid).reduce((a, b) => a && b, true)) {
        console.log("structure of one of the txOuts is not valid");
        return false;
    } else {a
        return true;
    }
};

const validateTxIn = (txIn, tx ,uTxOutList) => {
    const wantedTxOut = uTxOutList.find(uTxOut => uTxOut.txOutId === txIn.txOutId && uTxOut.txOutIndex === txIn.txOutIndex);
    if(wantedTxOut === null) {
        return false;
    } else {
        const address = wantedTxOut.address;
        const key = ec.keyFromPublic(address, "hex");
        return key.verify(tx.id, txIn.signature);
    }
}

const getAmountInTxIn = (txIn, uTxOutList) => findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTx = (tx, uTxOutList) => {
    if(getTxId(tx) !== tx.id) {
        return false;
    } else if(!isTxStructureValid(tx)) {
        return false;
    }

    const hasValidTxIns = tx.txIns.map(txIn => validateTxIn(txIn, tx, uTxOuts));

    if(!hasValidTxIns) {
        return false;
    }

    const amountInTxIns = tx.txIns.map(txIn => getAmountInTxIn(txIn, uTxOutList)).reduce((a, b) => a + b, 0);

    const amountInTxOuts = tx.txOuts.map(txOut => txOut.amount).reduce((a, b) => a + b, 0);

    if(amountInTxIns !== amountInTxOuts) {
        return false;
    } else {
        return true;
    }
};

const validateCoinbaseTx = (tx, blockIndex) => {
    if(getTxId(tx) !== tx.id) {
        console.log("Invalid Coinbase Tx ID");
        return false;
    } else if(tx.txIns.length !== 1) {
        console.log("Coinbase Tx should have only one input");
        return false;
    } else if(tx.txIns[0].txOutIndex !== blockIndex) {
        console.log("txOutInfex of the Coinbase Tx should be the same as the Block index");
        return false;
    } else if(tx.txOuts.length !== 1) {
        console.log("Coinbase Tx should have only one output");
        return false;
    } else if(tx.txOuts[0].amount !== COINBASE_AMOUNT) {
        console.log(`Coinbase Tx should have an amount of only ${COINBASE_AMOUNT} and it has ${tx.txOuts[0].amount}`);
        return false;
    } else {
        return true;
    } 
};

const createCoinbaseTx = (address, blockIndex) => {
    const tx = new Transaction();
    const txIn = new TxIn();
    txIn.signature = "";
    txIn.txOutId = blockIndex;
    tx.txIns = [txIn];
    tx.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    tx.id = getTxId(tx);

    return tx;
};

const validateBlockTx = (tx, uTxOutList, blockIndex) => {
    const coinbaseTx = tx[0];
    if(!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log("coinbase Tx is invalid");
    }
    
    const txIns = _(tx).map(tx => tx.Ins).flatten().value();
};

const processTxs = (txs, uTxOutList, blockIndex) => {
    if(!validateBlockTx(tx, uTxOutList, blockIndex)) {
        return null;
    }
    return updateUTxOuts(txs, uTxOutList);
};

module.exports = {
    getPublicKey,
    getTxId,
    signTxIn,
    TxIn,
    TxOut,
    Transaction,
    createCoinbaseTx 
};