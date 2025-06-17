# n8n-nodes-rogerroger

This is an n8n community node. It lets you use RogerRoger in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  
[Version history](#version-history)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

The node supports the following operations:

- Person
  - Get
  - Get many
  - Create
  - Update
  - Delete
- Organization
  - Get
  - Get many
  - Create
  - Update
  - Delete
- Task
  - Get
  - Get many
  - Create
  - Update
  - Delete

## Credentials

The node supports the API Key authentication method that is required to authenticate with the RogerRoger API.

## Compatibility

Tested against n8n version 1.95.3.

## Usage

1. Create a new person, organization, or task on RogerRoger.
2. Create a new workflow in n8n.
3. Add the RogerRoger node to your workflow.
4. Enter your API key and select the resource and operation you want to perform.
5. Execute the node.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [RogerRoger documentation](https://developer.rogerroger.io)

## Version history

- 1.0.0: Initial release