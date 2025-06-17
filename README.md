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

1. **Generate an API Key**: Visit the [RogerRoger API Admin](https://app.rogerroger.io/admin/api) to create your API key.

2. **Set Up Credentials in n8n**:
   - Navigate to the RogerRoger node in your n8n workflow.
   - Create a new credential and enter the API key you generated.

3. **Select a Resource**:
   - Choose one of the available resources you want to interact with: Person, Organization, or Task.

4. **Choose an Operation**:
   - Select the operation you wish to perform (e.g., Get, Create, Update, Delete).
   - Provide the necessary data for the selected operation.

5. **Execute the Node**:
   - Run the node to perform the selected operations on the RogerRoger platform.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [RogerRoger documentation](https://developer.rogerroger.io)

## Version history

- 1.0.0: Initial release
- 1.0.1: README updated
- 1.0.2:
	- Updated README
	- Moved repository to public Github
	- Text changes to improve consistancy between RogerRoger and N8N