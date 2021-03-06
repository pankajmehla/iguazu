/*
 * Copyright 2017 American Express
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import {
  mapValues,
  zipObject,
  isServer,
  handlePromiseRejection,
} from './utils';

export function reduceData(loadResponseMap) {
  return mapValues(loadResponseMap, (response) => response.data);
}

export function reduceStatus(loadResponseMap) {
  const responses = Object.values(loadResponseMap);

  const loadStatusMap = mapValues(loadResponseMap, (response) => response.status);
  loadStatusMap.all = responses
    .filter((response) => !response.noncritical)
    .map((response) => response.status)
    .every((s) => s === 'complete') ? 'complete' : 'loading';

  return loadStatusMap;
}

export function reduceErrors(loadResponseMap) {
  const responses = Object.values(loadResponseMap);

  const loadErrorMap = mapValues(loadResponseMap, (response) => response.error);
  loadErrorMap.any = responses
    .filter((response) => !response.noncritical)
    .map((response) => response.error)
    .some((error) => error);

  return loadErrorMap;
}

export function reducePromise(loadResponseMap) {
  return Promise.all(Object.values(loadResponseMap).map((response) => response.promise));
}

export function reducePromiseObject(loadResponseMap) {
  const keys = Object.keys(loadResponseMap);
  const promises = keys.map((key) => loadResponseMap[key].promise);

  return Promise.all(promises)
    .then((responses) => zipObject(keys, responses));
}

export default function iguazuReduce(loadFunc, { promiseAsObject = false } = {}) {
  return (loadInputs) => {
    if (isServer() && !loadFunc.ssr) { return { status: 'loading' }; }

    const loadFuncMap = loadFunc(loadInputs);
    const loadResponseMap = mapValues(loadFuncMap, (func) => func({ isServer: isServer() }));

    const data = reduceData(loadResponseMap);
    const status = reduceStatus(loadResponseMap).all;
    const error = reduceErrors(loadResponseMap).any;
    // TODO: Fix this to always return as object in next major version.
    const promise = promiseAsObject
      ? reducePromiseObject(loadResponseMap)
      : reducePromise(loadResponseMap);

    handlePromiseRejection(promise);

    return {
      data,
      status,
      error,
      promise,
    };
  };
}
