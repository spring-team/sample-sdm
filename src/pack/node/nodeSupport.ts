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

import { SeedDrivenGeneratorParameters } from "@atomist/automation-client/operations/generate/SeedDrivenGeneratorParameters";
import {
    DeclarationType,
    ExtensionPack,
    hasFile, ParametersObject, SemVerRegExp,
    SoftwareDeliveryMachine,
    ToDefaultBranch,
} from "@atomist/sdm";
import { GitHubRepoRef } from "@atomist/sdm";
import {allOf, BuildGoal, MappedParameters} from "@atomist/sdm";
import {
    IsNode,
    nodeBuilder,
    PackageLockFingerprinter,
    tslintFix,
} from "@atomist/sdm-pack-node";
import {executeBuild} from "@atomist/sdm/api-helper/goal/executeBuild";
import { metadata } from "@atomist/sdm/api-helper/misc/extensionPack";
import { AddAtomistTypeScriptHeader } from "../../autofix/addAtomistHeader";
import { UpdateReadmeTitle } from "../../commands/editors/updateReadmeTitle";
import { CommonTypeScriptErrors } from "../../reviewer/typescript/commonTypeScriptErrors";
import { DontImportOwnIndex } from "../../reviewer/typescript/dontImportOwnIndex";
import { AddBuildScript } from "./autofix/addBuildScript";
import { UpdatePackageJsonIdentification } from "./editors/updatePackageJsonIdentification";

export interface NodeProjectCreationParameters extends SeedDrivenGeneratorParameters {
    appName: string;
    screenName: string;
    version: string;
}

export const NodeProjectCreationParametersDefinition: ParametersObject = {

    appName: {
        displayName: "App name",
        description: "Application name",
        pattern: /^(@?[A-Za-z][-A-Za-z0-9_/]*)$/,
        validInput: "a valid package.json application name; letters and numbers and dashes and underscores. Might start with @npm-username/",
        minLength: 1,
        maxLength: 50,
        required: true,
        order: 51,
    },
    version: {
        ...SemVerRegExp,
        required: false,
        order: 52,
        defaultValue: "0.1.0",
    },
    screenName: { type: DeclarationType.mapped, uri: MappedParameters.SlackUserName},
};

/**
 * Add configuration common to Node SDMs, wherever they deploy
 * @param {SoftwareDeliveryMachine} sdm
 * @param options config options
 */
export const NodeSupport: ExtensionPack = {
    ...metadata("node"),
    configure: (sdm: SoftwareDeliveryMachine) => {
        const hasPackageLock = hasFile("package-lock.json");
        sdm.addGeneratorCommand({
            name: "typescript-express-generator",
            startingPoint: new GitHubRepoRef("spring-team", "typescript-express-seed"),
            intent: "create node",
            parameters: NodeProjectCreationParametersDefinition,
            transform: [
                UpdatePackageJsonIdentification,
                UpdateReadmeTitle],
        })
            .addGeneratorCommand({
                name: "minimal-node-generator",
                parameters: NodeProjectCreationParametersDefinition,
                startingPoint: new GitHubRepoRef("spring-team", "minimal-node-seed"),
                intent: "create minimal node",
                transform: [
                    UpdatePackageJsonIdentification,
                    UpdateReadmeTitle],
            })
            .addGeneratorCommand({
                name: "copySdm",
                parameters: NodeProjectCreationParametersDefinition,
                startingPoint: new GitHubRepoRef("atomist", "sdm"),
                intent: "copy sdm",
                transform: [
                    UpdatePackageJsonIdentification,
                    UpdateReadmeTitle],
            })
            .addGeneratorCommand({
                name: "buildable-node-generator",
                parameters: NodeProjectCreationParametersDefinition,
                startingPoint: new GitHubRepoRef("spring-team", "buildable-node-seed"),
                intent: "create buildable node",
                transform: [
                    UpdatePackageJsonIdentification,
                    UpdateReadmeTitle],
            })
            .addAutofix(AddAtomistTypeScriptHeader)
            .addAutofix(tslintFix)
            .addAutofix(AddBuildScript)
            .addAutoInspectRegistration(CommonTypeScriptErrors)
            .addAutoInspectRegistration(DontImportOwnIndex)
            .addFingerprinterRegistration(new PackageLockFingerprinter());
        const nodeCiRunBuild = nodeBuilder(sdm, "npm ci", "npm run build");
        const nodeCiRunCompile = nodeBuilder(sdm, "npm ci", "npm run compile");
        const nodeIRunBuild = nodeBuilder(sdm, "npm i", "npm run build");
        const nodeIRunCompile = nodeBuilder(sdm, "npm i", "npm run compile");
        sdm.addGoalImplementation("npm run build",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeCiRunBuild),
            {
                pushTest: allOf(IsNode, ToDefaultBranch, hasPackageLock),
                logInterpreter: nodeCiRunBuild.logInterpreter,
            });
        sdm.addGoalImplementation("npm run compile",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeCiRunCompile),
            {
                pushTest: allOf(IsNode, hasPackageLock),
                logInterpreter: nodeCiRunCompile.logInterpreter,
            });
        sdm.addGoalImplementation("npm run build - no package lock",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeIRunBuild),
            {
                pushTest: allOf(IsNode, ToDefaultBranch),
                logInterpreter: nodeIRunBuild.logInterpreter,
            });
        sdm.addGoalImplementation("npm run compile - no package lock",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeIRunCompile),
            {
                pushTest: allOf(IsNode),
                logInterpreter: nodeIRunCompile.logInterpreter,
            });

    },
};
