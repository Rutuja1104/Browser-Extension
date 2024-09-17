import { SYSTEM_URL_REGEXP } from "../../framework/constants";
import { AthenaNetEhr } from "./athena-net-ehr";
import { PracticeFusionEhr } from "./practice-fusion-ehr";
import { OpenEmrEhr } from "./open-emr-ehr";
import { EclinicalWebEhr } from "./eclinical-web-ehr";

export class SystemFactory {
    getSystem(onUnloadCb) {
        let url = window?.location?.href;
        if (RegExp(SYSTEM_URL_REGEXP.athenaNet).exec(url)) {
            return new AthenaNetEhr(onUnloadCb);
        } else if (RegExp(SYSTEM_URL_REGEXP.practiceFusion).exec(url)) {
            return new PracticeFusionEhr(onUnloadCb);
        }else if (RegExp(SYSTEM_URL_REGEXP.openEmr).exec(url)) {
            return new OpenEmrEhr(onUnloadCb);
        } else if (RegExp(SYSTEM_URL_REGEXP.eclinicalweb).exec(url)) {
            return new EclinicalWebEhr(onUnloadCb);
        } 
        else {
            return null;
        }
    }
}