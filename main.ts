// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import { Construct } from "constructs";
import { App, TerraformStack, CloudBackend, NamedCloudWorkspace } from "cdktf";
import * as google from '@cdktf/provider-google-beta';

const project = 'cautious-disco';
const region = 'us-central1';
const repository = 'cautious-disco';

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new google.provider.GoogleBetaProvider(this, 'google', {
      project,
      region,
    });

    new google.googleCloudbuildTrigger.GoogleCloudbuildTrigger(this, 'trigger', {
      filename: 'cloudbuild.yaml',
      github: {
        owner: 'hsmtkk',
        name: repository,
        push: {
          branch: 'main',
        },
      },
    });

    new google.googleArtifactRegistryRepository.GoogleArtifactRegistryRepository(this, 'registry', {
      format: 'docker',
      location: region,
      repositoryId: 'registry',
    });

    const runner = new google.googleServiceAccount.GoogleServiceAccount(this, 'runner', {
      accountId: 'runner',
    });

    const example_service = new google.googleCloudRunService.GoogleCloudRunService(this, 'example-service', {
      autogenerateRevisionName: true,
      location: region,
      name: 'example-service',
      template: {
        spec: {
          containers: [{
            image: 'us-docker.pkg.dev/cloudrun/container/hello',
          }],
          serviceAccountName: runner.email,
        },
      },
    });

    const run_noauth = new google.dataGoogleIamPolicy.DataGoogleIamPolicy(this, 'run-noauth', {
      binding: [{
        members: ['allUsers'],
        role: 'roles/run.invoker',
      }],
    });

    new google.googleCloudRunServiceIamPolicy.GoogleCloudRunServiceIamPolicy(this, 'run-noauth-policy', {
      location: region,
      policyData: run_noauth.policyData,
      service: example_service.name,      
    });

    const test_target = new google.googleClouddeployTarget.GoogleClouddeployTarget(this, 'test-target', {
      run: {
        location: `projects/${project}/locations/${region}`,
      },
      executionConfigs: [{
        usages: ['RENDER', 'DEPLOY', 'VERIFY']
      }],
      location: region,
      name: 'test-target',
    });

    const production_target = new google.googleClouddeployTarget.GoogleClouddeployTarget(this, 'production-target', {
      run: {
        location: `projects/${project}/locations/${region}`,
      },
      executionConfigs: [{
        usages: ['RENDER', 'DEPLOY', 'VERIFY']
      }],
      location: region,
      name: 'production-target',
      requireApproval: true,
    });

    new google.googleClouddeployDeliveryPipeline.GoogleClouddeployDeliveryPipeline(this, 'pipeline', {
      location: region,
      name: 'pipeline',
      serialPipeline: {
        stages: [
          {
            profiles: ['test'],
            targetId: test_target.id,
          },
          {
            profiles: ['production'],
            targetId: production_target.id,
          },
        ],
      },
    });

  }
}

const app = new App();
const stack = new MyStack(app, "cautious-disco");
new CloudBackend(stack, {
  hostname: "app.terraform.io",
  organization: "hsmtkkdefault",
  workspaces: new NamedCloudWorkspace("cautious-disco")
});
app.synth();
