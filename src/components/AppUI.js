import React, { useEffect, useState } from 'react';
import {databaseHandler,initCommonInstance} from 'container-common/src/helpers/common-helper'
import {operationTypes, containerTypes} from 'container-common/src/helpers/constant'



const AppUI = () => {
  initCommonInstance(containerTypes.BROWSER,chrome);
  const [encryptedConfigdetails, setEncryptedConfigdetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [enablementDate, setEnablementDate] = useState('');
  const [showError, setShowError] = useState(false);

  const handleTextChange = (event) => {
    setEncryptedConfigdetails(event.target.value);
    setShowError(false);
  };

  useEffect(() => {
    checkIsEnabled();
  }, []);

  const checkIsEnabled = async () => {
    initCommonInstance(containerTypes.BROWSER, chrome)
    try {
      if (!isEnabled) {
        let tokenData = await databaseHandler(operationTypes.GET, 'tokenDetails');
        tokenData = JSON.parse(tokenData)
        const parseTokenData = tokenData;
        if (parseTokenData?.accessToken) {
          setIsEnabled(true);
          const date = new Date(parseTokenData.containerCreatedAt);
          const options = {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          };
          const formattedDate = date.toLocaleDateString('en-US', options);
          setEnablementDate(formattedDate);
          chrome.runtime.sendMessage({ action: 'authSuccess' });
        }
      } 
    } catch (error) {
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const response = await chrome.runtime.sendMessage({
      action: 'handleEnblement',
      data: encryptedConfigdetails.trim(),
    });
    if (!response) {
      setShowError(true);
      setIsLoading(false);
    } else {
      setIsEnabled(true);
      window.close();
    }
  };

  return (
    <form id="configInput" className="enablement-form">
      {isEnabled ? (
        <>
          <h2>Brand's Popup</h2>
          <h4>{`Last Enabled on: ${enablementDate}`}</h4>
        </>
      ) : (
        <>
          <h2>InsiteFlow Container</h2>
          <label htmlFor="enablementKey">Enter Enablement Key</label>
          <textarea
            id="enablementKey"
            value={encryptedConfigdetails}
            onChange={handleTextChange}
            placeholder="Enter Enablement key..."
          />
          {showError && (
            <p className="errorAlert">Enablement key not accepted</p>
          )}
          <button type="submit" id="submitButton" onClick={handleSubmit}>
            {isLoading ? 'Loading...' : 'Submit'}
          </button>
        </>
      )}
    </form>
  );
};

export default AppUI;