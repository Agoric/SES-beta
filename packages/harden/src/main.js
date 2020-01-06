// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// Copyright (C) 2018 Agoric

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import makeHardener from '@agoric/make-hardener';
import buildTable from './buildTable.js';

// this use of 'global' is why Harden is a "resource module", whereas
// MakeHardener is "pure".
const initialRoots = buildTable((1, eval)('this')); // eslint-disable-line no-eval
// console.log('initialRoots are', initialRoots);

const harden = makeHardener(initialRoots);

export default harden;
