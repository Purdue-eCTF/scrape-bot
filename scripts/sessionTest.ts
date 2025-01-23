import { getAuthedSessionNonce } from '../modules/ctfd';


;(async () => {
    const { session, nonce } = await getAuthedSessionNonce();
    console.log(session);
    console.log(nonce);
})();
