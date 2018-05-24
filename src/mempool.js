const _ = require("lodash"),
    Transactions = require("./transactions");

const { validateTx } = Transactions;

let mempool = [];

const getMempool = () => _.cloneDeep(mempool);

const getTxInsPool = mempool => {
    return _(mempool).map(tx => tx.Ins).flatten().value();
};

const isTxValidForPool = (tx, mempool) => {
    const txInsInPool = getTxInsPool(mempool);
    const isTxInAlreadyInPool = (txIns, txIn) => {
        return _.find(txIns, txInInPool => {
            return (
                txIn.txOutIndex === txInInPool.txOutIndex &&
                txIn.txOutId === txInInPool.txOutId
            );
        });
    }

    for (const txIn of tx.txIns) {
        if(isTxInAlreadyInPool(txInsInPool, txIn)) {
            return false;
        }
    }
    return true;
};

const addToMempool = (tx, uTxOutList) => {
    if(!validateTx(tx, uTxOutList)) {
        throw Error("This tx is invalid. It will not be added to the pool");
    } else if(!isTxValidForPool(tx, mempool)) {
        throw Error("This tx is not valid for pool. It will not be added to the pool");
    }
    mempool.push(tx);
};

module.exports = {
    addToMempool,
    getMempool
}