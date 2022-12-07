// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import { Construct } from "constructs";
import { App, TerraformStack, CloudBackend, NamedCloudWorkspace } from "cdktf";
import * as google from '@cdktf/provider-google';

const project = 'cautious-disco';
const region = 'us-central1';
const repository = 'cautious-disco';

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new google.provider.GoogleProvider(this, 'google', {
      project,
      region,
    });

    new google.cloudbuildTrigger.CloudbuildTrigger(this, 'trigger', {
      filename: 'cloudbuild.yaml',
      github: {
        owner: 'hsmtkk',
        name: repository,
        push: {
          branch: 'main',
        },
      },
    });

    new google.artifactRegistryRepository.ArtifactRegistryRepository(this, 'registry', {
      format: 'docker',
      location: region,
      repositoryId: 'registry',
    });

    const runner = new google.serviceAccount.ServiceAccount(this, 'runner', {
      accountId: 'runner',
    });

    const example_service = new google.cloudRunService.CloudRunService(this, 'example-service', {
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

    new google.cloudRunServiceIamPolicy.CloudRunServiceIamPolicy(this, 'run-noauth-policy', {
      location: region,
      policyData: run_noauth.policyData,
      service: example_service.name,      
    });

    const test_target = new google.clouddeployTarget.ClouddeployTarget(this, 'test-target', {
      location: region,
      name: 'test-target',
    });

    const production_target = new google.clouddeployTarget.ClouddeployTarget(this, 'production-target', {
      location: region,
      name: 'production-target',
      requireApproval: true,
    });

    new google.clouddeployDeliveryPipeline.ClouddeployDeliveryPipeline(this, 'pipeline', {
      location: region,
      name: 'pipeline',
      serialPipeline: {
        stages: [
          {targetId: test_target.id},
          {targetId: production_target.id},
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
