export function coinsCreatedEndpoint(devWallet) {
  return `https://client-api-2-74b1891ee9f9.herokuapp.com/coins?offset=0&limit=10&sort=created_timestamp&order=desc&includeNsfw=false&creator=${devWallet}`
}