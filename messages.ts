import type {BuildStatusUpdateReq} from './bot';


export function statusToColor(status: BuildStatusUpdateReq['status']) {
    switch (status) {
        case 'SUCCESS': return 0x79ff3b;
        case 'BUILDING': return 0xf6b40c;
        case 'FAILURE': return 0xb50300;
    }
}
