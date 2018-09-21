import { ComparisonPolicy, Feature } from "../Feature";
import { AutoCodeInspection, PushImpact, PushImpactListenerInvocation, SoftwareDeliveryMachine } from "@atomist/sdm";
import { buttonForCommand, Fingerprint, logger, RemoteRepoRef } from "@atomist/automation-client";
import { FeatureStore } from "../FeatureStore";
import { Attachment, SlackMessage } from "@atomist/slack-messages";

/**
 * Integrate a number of features with an SDM
 */
export class Features {

    private readonly features: Feature[];

    /**
     * Enable these features on the given SDM
     */
    public enable(sdm: SoftwareDeliveryMachine, opts: {
        pushImpactGoal?: PushImpact,
        inspectGoal?: AutoCodeInspection,
    } = {}): void {
        // TODO add command to list features on a repo

        this.features.filter(f => !!f.apply)
            .forEach(f => {
                logger.info("Enabling %d features: %j", this.features.length, opts);
                const transformName = `tr-${f.name}`;
                sdm.addCodeTransformCommand({
                    name: transformName,
                    intent: `transform ${f.name}`,
                    transform: f.apply(f.ideal),
                });
                if (!!opts.inspectGoal) {
                    logger.info("Registering inspection goal");
                    opts.inspectGoal.with(f.inspection);
                }
                if (!!opts.pushImpactGoal) {
                    logger.info("Registering push impact goal");
                    // Register a push reaction when a project with this features changes
                    opts.pushImpactGoal.with({
                        name: `pi-${f.name}`,
                        pushTest: f.isPresent,
                        action: async pu => {
                            logger.info("Push on project with feature %s", f.name);
                            if (f.supportedComparisonPolicies.includes(ComparisonPolicy.quality)) {
                                const ideal = await this.store.ideal(f.name);
                                logger.info("Ideal feature %s value is %j", f.name, ideal);
                                if (!!ideal) {
                                    const after = await f.projectFingerprinter(pu.project);
                                    if (f.compare(ideal, after, ComparisonPolicy.quality) > 0) {
                                        // TODO ask
                                        await this.store.setIdeal(after);
                                        return rollout(f, ideal, transformName, sdm, pu);
                                    }
                                }
                            } else {
                                logger.info("Feature %s doesn't support quality comparison", f.name);
                            }
                        },
                    });
                }
            });
    }

    constructor(private readonly store: FeatureStore, ...features: Feature[]) {
        this.features = features;
    }

}

/**
 * Roll out buttons in all repos
 * @param {Feature} feature
 * @param {SoftwareDeliveryMachine} sdm
 * @param {PushImpactListenerInvocation} i
 * @return {Promise<void>}
 */
async function rollout<S extends Fingerprint>(feature: Feature<S>,
                                              value: S,
                                              command: string,
                                              sdm: SoftwareDeliveryMachine,
                                              i: PushImpactListenerInvocation) {
    // TODO factor out iteration and put in sdm
    const repos = await sdm.configuration.sdm.repoFinder(i.context);
    for (const id of repos) {
        await sdm.configuration.sdm.projectLoader.doWithProject(
            { credentials: i.credentials, id: id as RemoteRepoRef, readOnly: false },
            async p => {
                const found = !!await feature.projectFingerprinter(p);
                if (found) {
                    const attachment: Attachment = {
                        text: `Accept new feature ${feature.name}: ${feature.summary(value)}?`,
                        fallback: "accept feature",
                        actions: [buttonForCommand({ text: `Accept feature ${feature.name}` },
                            command,
                            { "targets.owner": id.owner, "targets.repo": id.repo },
                        ),
                        ],
                    };
                    const message: SlackMessage = {
                        attachments: [attachment],
                    };
                    await i.context.messageClient.addressChannels(message, p.id.repo);
                }
            });
    }
}

// function reviewerRegistration(f: Feature): ReviewerRegistration {
//     return {
//         name: f.name,
//         pushTest: f.isRelevant,
//         inspection: f.reviewer,
//     };
// }
