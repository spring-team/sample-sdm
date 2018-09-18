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
    AnyPush,
    ArtifactGoal,
    AutoCodeInspection,
    Autofix,
    Build,
    executeDeploy,
    GitHubRepoRef,
    goalContributors,
    goals,
    not,
    onAnyPush,
    ProductionEndpointGoal,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    StagingDeploymentGoal,
    StagingEndpointGoal,
    StagingVerifiedGoal,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    deploymentFreeze,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    ExplainDeploymentFreezeGoal,
    InMemoryDeploymentStatusManager,
    isDeploymentFrozen,
    isInLocalMode,
    ManagedDeploymentTargeter,
} from "@atomist/sdm-core";
import {
    CloudFoundrySupport,
    EnvironmentCloudFoundryTarget,
    HasCloudFoundryManifest,
} from "@atomist/sdm-pack-cloudfoundry";
import { enableDeployOnCloudFoundryManifestAddition } from "@atomist/sdm-pack-cloudfoundry/lib/listeners/enableDeployOnCloudFoundryManifestAddition";
import { NodeSupport } from "@atomist/sdm-pack-node";
import {
    IsMaven,
    localExecutableJarDeployer,
    MavenBuilder,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    SpringSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { StagingUndeploymentGoal } from "@atomist/sdm/lib/pack/well-known-goals/commonGoals";
import { CloudReadinessChecks } from "../pack/cloud-readiness/cloudReadiness";
import { DemoEditors } from "../pack/demo-editors/demoEditors";
import { JavaSupport } from "../pack/java/javaSupport";
import { SentrySupport } from "../pack/sentry/sentrySupport";
import { configureForLocal } from "./support/configureForLocal";
import { addTeamPolicies } from "./teamPolicies";
import { CloudFoundryDeploymentGoal } from "../goal/CloudFoundryDeploymentGoal";
import { PlaceholderDeploy } from "../deployment/placeholderDeploy";
import { SuggestedActionGoal } from "../goal/SuggestedActionGoal";

const freezeStore = new InMemoryDeploymentStatusManager();

const IsDeploymentFrozen = isDeploymentFrozen(freezeStore);

/**
 * Variant of cloudFoundryMachine that uses additive, "contributor" style goal setting.
 * @return {SoftwareDeliveryMachine}
 */
export function additiveCloudFoundryMachine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        {
            name: "Cloud Foundry software delivery machine",
            configuration,
        });

    sdm.addCommand<{ name: string }>({
        name: "hello",
        intent: "hello",
        parameters: {
            name: { description: "Your name" },
        },
        listener: async cli => cli.addressChannels(`Hello ${cli.parameters.name}`),
    });

    codeRules(sdm);

    if (isInLocalMode()) {
        configureForLocal(sdm);
    } else {
        deployRules(sdm);
    }
    addTeamPolicies(sdm);

    return sdm;
}

export function codeRules(sdm: SoftwareDeliveryMachine) {

    // Each contributor contributes goals. The infrastructure assembles them into a goal set.
    const AutofixGoal = new Autofix();
    const PushReactionGoal = new PushImpact();
    const CodeInspectionGoal = new AutoCodeInspection();

    //const ProductionDeploymentGoal = new CloudFoundryDeploymentGoal(sdm, new EnvironmentCloudFoundryTarget("production"));
    const CheckGoals = goals("Checks")
        .plan(CodeInspectionGoal, PushReactionGoal, AutofixGoal);
    const BuildGoals = goals("Build")
        .plan(new Build().with({ name: "Maven", builder: new MavenBuilder(sdm) }))
        .after(AutofixGoal);
    const StagingDeploymentGoals = goals("StagingDeployment")
        .plan(ArtifactGoal,
            StagingDeploymentGoal,
            StagingEndpointGoal,
            StagingVerifiedGoal);
    const ProductionDeploymentGoals = goals("ProdDeployment")
        .plan(
            new SuggestedActionGoal("Production Deploy",
                "I'd love to deploy for you, but you haven't told me how!\n" +
                "For example, to deploy to Cloud Foundry, add the PCF pack and  a CloudFoundryDeploymentGoal",
                "https://github.com/atomist/sdm-pack-cloudfoundry/blob/master/README.md"
            )).after(ArtifactGoal, StagingVerifiedGoal);

    sdm.addGoalContributions(goalContributors(
        onAnyPush().setGoals(CheckGoals),
        whenPushSatisfies(IsDeploymentFrozen)
            .setGoals(ExplainDeploymentFreezeGoal),
        whenPushSatisfies(IsMaven)
            .setGoals(BuildGoals),
        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(StagingDeploymentGoals),
        whenPushSatisfies(HasCloudFoundryManifest, not(IsDeploymentFrozen), ToDefaultBranch)
            .setGoals(ProductionDeploymentGoals)
    ));

    sdm.addGeneratorCommand<SpringProjectCreationParameters>({
        name: "create-spring",
        intent: "create spring",
        description: "Create a new Java Spring Boot REST service",
        parameters: SpringProjectCreationParameterDefinitions,
        startingPoint: new GitHubRepoRef("spring-team", "spring-rest-seed"),
        transform: [
            ReplaceReadmeTitle,
            SetAtomistTeamInApplicationYml,
            TransformSeedToCustomProject,
        ],
    })

        .addGeneratorCommand<SpringProjectCreationParameters>({
            name: "create-spring-kotlin",
            intent: "create spring kotlin",
            description: "Create a new Kotlin Spring Boot REST service",
            parameters: SpringProjectCreationParameterDefinitions,
            startingPoint: new GitHubRepoRef("johnsonr", "flux-flix-service"),
            transform: [
                ReplaceReadmeTitle,
                SetAtomistTeamInApplicationYml,
                TransformSeedToCustomProject,
            ],
        });

    sdm.addExtensionPacks(
        DemoEditors,
        deploymentFreeze(freezeStore),
        SpringSupport,
        SentrySupport,
        CloudReadinessChecks,
        JavaSupport,
        NodeSupport,
        CloudFoundrySupport,
    );
}

export function deployRules(sdm: SoftwareDeliveryMachine) {
    const deployToStaging = {
        deployer: localExecutableJarDeployer(),
        targeter: ManagedDeploymentTargeter,
        deployGoal: StagingDeploymentGoal,
        endpointGoal: StagingEndpointGoal,
        undeployGoal: StagingUndeploymentGoal,
    };
    sdm.addGoalImplementation("Staging local deployer",
        deployToStaging.deployGoal,
        executeDeploy(
            sdm.configuration.sdm.artifactStore,
            sdm.configuration.sdm.repoRefResolver,
            deployToStaging.endpointGoal, deployToStaging),
        {
            pushTest: IsMaven,
            logInterpreter: deployToStaging.deployer.logInterpreter,
        },
    );
    sdm.addGoalSideEffect(
        deployToStaging.endpointGoal,
        deployToStaging.deployGoal.definition.displayName,
        AnyPush);

    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addPushImpactListener(enableDeployOnCloudFoundryManifestAddition(sdm));
    // sdm.addEndpointVerificationListener(lookFor200OnEndpointRootGet());
}
