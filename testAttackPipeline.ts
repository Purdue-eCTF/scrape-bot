import {initExploitsRepo, supplyChain} from './modules/supply';
import {initTargetsRepo} from './modules/slack';


;(async () => {
     await initExploitsRepo();
     await supplyChain('SMCAA');
})();
