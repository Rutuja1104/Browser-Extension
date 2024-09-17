
export class EclinicalWebEhr {
  constructor(onUnloadCb) {
    this.onUnloadCb = onUnloadCb;
    this.registeredUnloadEvent = false;
  }

  discoverContext = async () => {
    const ctxData = { userDetails: {} };
    let  ecwItemKey = sessionStorage.getItem('ECW_ITEM_KEY');
    let portalObj = ecwItemKey && JSON.parse(ecwItemKey);
    let accountId = portalObj?.Portal_System_Account_ID?.value
    ctxData['userDetails']['context_id'] = accountId
    let inputElement = document.getElementById('userProId');
    let userProIdValue = inputElement?.value;
    ctxData['userDetails']['providerId'] = userProIdValue;
    let providerEle = document.querySelector('h2.mt3.field-break.ng-binding');
    if (providerEle) {
      let providerUsername = providerEle.textContent;
      ctxData['userDetails']['username'] = providerUsername;
    }
    let patientElement = document.querySelector(
      'span.ml5.fs11.patient-identifier-span'
    );
    let patientContent = patientElement?.textContent;
    let accNoMatch = RegExp(/Acc No\. (\d+)/).exec(patientContent);

    if (accNoMatch && accNoMatch.length > 1) {
      let accNo = accNoMatch[1];
      ctxData['patientId'] = accNo;
    }
    let patientInfoElement = document.querySelector('.modal-title.pull-left.ng-isolate-scope');
    let patientInfoText = patientInfoElement?.textContent.trim();
    let infoParts = patientInfoText?.split(/🎂|📁/);
    if(infoParts){
      let patientNameData =  infoParts[0]?.trim()?.split('Patient Information');
      let dob =infoParts[1]?.trim().split('(')[0]; 
      ctxData['firstname'] = patientNameData[1]?.split(',')[0];
      ctxData['lastname'] = patientNameData[1]?.split(', ')[1];
      ctxData['DOB']=dob
    }else{
      ctxData['firstname'] = ctxData['lastname'] = ctxData['DOB'] = undefined;
    }

    let selectElement = document.getElementById('facilities');
    let secondOption = selectElement?.querySelectorAll('option')[1];
    let dataColor = secondOption?.getAttribute('data-color');
    ctxData['userDetails']['tenantId'] = dataColor;

    const sessionCookies = await chrome.runtime.sendMessage({
      action: 'getSessionCookies',
      url: window.location.origin,
      ehr: 'ECLINICAL',
    });

    ctxData['userDetails']['sessionId'] = sessionCookies?.sessionId;
    let divElements = document.querySelectorAll('div[ng-include]');
    divElements.forEach(function (div) {
      let srcValue = div.getAttribute('src');
      if (srcValue?.includes('patientlabletterpopupurl')) {
        let scriptElements = div.querySelectorAll('script');
        scriptElements.forEach(function (script) {
          let scriptContent = script.textContent || script.innerText;
          if (scriptContent.includes('"encounterId"')) {
            let encounterId = RegExp(/"encounterId":(\d+)/).exec(scriptContent);
            if (encounterId) {
              ctxData['encounterId'] = encounterId[1];
            }
          }
        });
      }
    });
    let encounterDivElement = document.querySelector('div.det-view.nopadtop.nopadbot');
    if (!encounterDivElement) {
        ctxData['encounterId'] = undefined
    }
    return { ctxData };
  };

  domLoaded = async () => {
    return new Promise((resolvePromise, rejectPromise) => {
      const globalWrapper = document.getElementById('webemrApp');
      if (globalWrapper) {
        if (!this.registeredUnloadEvent) {
          globalWrapper?.addEventListener('beforeunload', async () => {
            await setTimeout(this.onUnloadCb, 100);
          });
          this.registeredUnloadEvent = true;
        }

        resolvePromise(true);
      } else {
        resolvePromise(false);
      }
    });
  };
}
