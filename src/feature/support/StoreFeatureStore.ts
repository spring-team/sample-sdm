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

import { FeatureStore } from "../FeatureStore";
import { FingerprintData } from "@atomist/automation-client";
import { RemoteRepoRef } from "@atomist/automation-client";
import { Store } from "../Store";

export class StoreFeatureStore implements FeatureStore {

    public static create(store: Store, ...ideals: FingerprintData[]): FeatureStore {
        const fs = new StoreFeatureStore(store);
        for (const ideal of ideals) {
            fs.setIdeal(ideal);
        }
        return fs;
    }

    public async ideal(name: string): Promise<FingerprintData | undefined> {
        const found = await this.internalStore.load(toIdealKey(name));
        return found;
    }

    public async setIdeal(f: FingerprintData): Promise<any> {
        return this.internalStore.save(f, toIdealKey(f.name));
    }

    public async store(id: RemoteRepoRef, f: FingerprintData): Promise<any> {
        return this.internalStore.save(f, toKey(id));
    }

    private constructor(private readonly internalStore: Store) {}

}

function toKey(rr: RemoteRepoRef): string {
    return rr.url;
}

function toIdealKey(name: string): string {
    return `ideal_${name}`;
}