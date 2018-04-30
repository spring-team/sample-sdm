/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { InMemoryFile } from "@atomist/automation-client/project/mem/InMemoryFile";
import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import * as assert from "power-assert";
import { FileIoImportReviewer } from "../../../../../src/blueprint/code/review/java/fileIoImportReviewer";
import { fakeListenerInvocation } from "./spring/hardCodedPropertyReviewerTest";

describe("fileIoImport", () => {

    it("should not find any problems in empty project", async () => {
        const id = new GitHubRepoRef("a", "b");
        const p = InMemoryProject.from(id);
        const r = await FileIoImportReviewer.action(fakeListenerInvocation(p) as any);
        assert.equal(r.comments.length, 0);
    });

    it("pass harmless Java code", async () => {
        const id = new GitHubRepoRef("a", "b");
        const p = InMemoryProject.from(id, new InMemoryFile("src/main/java/Thing.java", "public class Thing {}"));
        const r = await FileIoImportReviewer.action(fakeListenerInvocation(p) as any);
        assert.equal(r.comments.length, 0);
    });

    it("flag file import in Java", async () => {
        const id = new GitHubRepoRef("a", "b");
        const f = new InMemoryFile("src/main/java/Thing.java",
            "import java.io.File;\npublic class Thing {}");
        const p = InMemoryProject.from(id, f);
        const r = await FileIoImportReviewer.action(fakeListenerInvocation(p) as any);
        assert.equal(r.comments.length, 1);
        const comment = r.comments[0];
        assert.equal(comment.category, "file-import");
        assert.equal(comment.sourceLocation.path, f.path);
    });

    it("flag file import in Kotlin", async () => {
        const id = new GitHubRepoRef("a", "b");
        const f = new InMemoryFile("src/main/kotlin/Thing.kt",
            "import java.io.File;\npublic class Thing {}");
        const p = InMemoryProject.from(id, f);
        const r = await FileIoImportReviewer.action(fakeListenerInvocation(p) as any);
        assert.equal(r.comments.length, 1);
        const comment = r.comments[0];
        assert.equal(comment.category, "file-import");
        assert.equal(comment.sourceLocation.path, f.path);
    });

});

/* tslint:disable */
