const db = require('./db');

async function getTimestamp(hash) {
  return await db.knex('timestamps').where({ hash }).select();
}
async function getTimestamps(hashes) {
  const returnHashes = {};
  const dbHashes = await db.knex('timestamps').whereIn('hash', hashes).select();

  hashes.forEach(hash => {
    const dbResult = dbHashes.find(dbHash => dbHash.hash === hash);
    returnHashes[hash] = dbResult ? dbResult.timestamp : null;
  });

  return returnHashes;
}

module.exports = {
  getTimestamp,
  getTimestamps,
};