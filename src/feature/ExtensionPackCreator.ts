/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    AutoCodeInspection,
    Autofix,
    Fingerprint as FingerprintGoal,
    PushImpact,
} from "@atomist/sdm";

/**
 * Goals in an SDM that should be customized by an ExtensionPack returned by an ExtensionPackCreator
 */
export interface WellKnownGoals {

    /**
     * pushImpactGoal to add push impact reactions to.
     */
    pushImpactGoal?: PushImpact,

    /**
     * Inspect goal to add inspections to.
     * Review functionality won't work otherwise.
     */
    inspectGoal?: AutoCodeInspection;

    /**
     * Autofix goal to add autofixes to.
     * Autofix functionality won't work otherwise.
     */
    autofixGoal?: Autofix;

    /**
     * Fingerprint goal to add fingerprints to.
     * Fingerprint functionality won't work otherwise.
     */
    fingerprintGoal?: FingerprintGoal;
}
