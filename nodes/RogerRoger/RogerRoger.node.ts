import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

interface CredentialInterface {
	apiKey: string,
	apiBaseUrl: string
}

// Constants
const RESOURCES = {
	PERSON: 'person',
	ORGANIZATION: 'organization',
	TASK: 'task',
	TAG: 'tag',
	SEGMENT: 'segment',
} as const;

const OPERATIONS = {
	GET: 'get',
	GET_MANY: 'getMany',
	CREATE: 'create',
	UPDATE: 'update',
	DELETE: 'delete',
} as const;

const ENDPOINTS = {
	[RESOURCES.PERSON]: 'people',
	[RESOURCES.ORGANIZATION]: 'organizations',
	[RESOURCES.TASK]: 'tasks',
	[RESOURCES.TAG]: 'tags',
	[RESOURCES.SEGMENT]: 'segments',
} as const;

const COLUMN_TITLE_MAP: Record<string, string> = {
	'workspace.column.open': 'Open',
	'workspace.column.inprogress': 'In Progress',
	'workspace.column.done': 'Done',
};

// Global cache for workspace columns
const workspaceColumnsCache: Record<string, Array<{ id: string; title: string }>> = {};

// Utility functions
function generateOperationOptions(resource: string) {
	return Object.values(OPERATIONS).map(op => {
		const isGetMany = op === OPERATIONS.GET_MANY;
		const operationName = isGetMany ? 'Get many' : op.charAt(0).toUpperCase() + op.slice(1);
		const resourceDescription = isGetMany ? `${resource}s` : resource; // Pluralize resource for GET_MANY

		return {
			name: operationName,
			value: op,
			description: `${operationName} ${resourceDescription}`,
			action: `${operationName} ${resourceDescription}`,
		};
	});
}

function prettifyColumnTitle(rawTitle: string): string {
	return COLUMN_TITLE_MAP[rawTitle] ?? rawTitle;
}

function createHttpRequestOptions(
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	url: string,
	apiKey: string,
	body?: any,
): IHttpRequestOptions {
	const options: IHttpRequestOptions = {
		method,
		url,
		headers: {
			'X-API-KEY': apiKey,
			'Accept': 'application/ld+json',
		},
		json: true,
	};

	if (body) {
		options.headers!['Content-Type'] = method === 'PATCH'
			? 'application/merge-patch+json'
			: 'application/json';
		options.body = body;
	}

	return options;
}

function buildPersonRequestBody(
	givenName?: string,
	familyName?: string,
	emailAddresses?: string[],
	phoneNumbers?: string[],
	addressDetails?: {
		street?: string;
		city?: string;
		postalCode?: string;
	},
	linkedinId?: string,
	jobTitle?: string,
	customerId?: string,
	organizations?: string[],
	tags?: string[],
	segments?: string[]
): any {
	const body: any = {};

	if (givenName) body.givenName = givenName;
	if (familyName) body.familyName = familyName;
	if (linkedinId) body.linkedinId = linkedinId;
	if (jobTitle) body.jobTitle = jobTitle;
	if (customerId) body.customerId = customerId;
	if (organizations?.length) body.organizations = organizations;
	if (tags?.length) body.tags = tags;
	if (segments?.length) body.segments = segments;

	if (emailAddresses?.length) {
		body.emailAddresses = emailAddresses.map(email => ({ email }));
	}

	if (phoneNumbers?.length) {
		body.phoneNumbers = phoneNumbers.map(phoneNumber => ({ phoneNumber }));
	}

	if (addressDetails) {
		const { street, city, postalCode } = addressDetails;
		if (street || city || postalCode) {
			body.address = {
				...(street && { street }),
				...(city && { city }),
				...(postalCode && { postalCode }),
			};
		}
	}

	return body;
}

function buildOrganizationRequestBody(
	title?: string,
	website?: string,
	description?: string,
	emailAddresses?: string[],
	phoneNumbers?: string[],
	customerId?: string,
	chamberOfCommerceNumber?: string,
	tags?: string[],
	segments?: string[],
	people?: string[],
	addressDetails?: {
		street?: string;
		city?: string;
		postalCode?: string;
		country?: string;
	},
): any {
	const body: any = {};

	if (title) body.title = title;
	if (website) body.website = website;
	if (description) body.description = description;
	if (customerId) body.customerId = customerId;
	if (chamberOfCommerceNumber) body.chamberOfCommerceNumber = chamberOfCommerceNumber;
	if (tags?.length) body.tags = tags;
	if (segments?.length) body.segments = segments;
	if (people?.length) body.people = people;

	if (emailAddresses?.length) {
		body.emailAddresses = emailAddresses.map(email => ({ email }));
	}

	if (phoneNumbers?.length) {
		body.phoneNumbers = phoneNumbers.map(phoneNumber => ({ phoneNumber }));
	}

	if (addressDetails) {
		const { street, city, postalCode, country } = addressDetails;
		if (street || city || postalCode || country) {
			body.address = {
				...(street && { street }),
				...(city && { city }),
				...(postalCode && { postalCode }),
				...(country && { country }),
			};
		}
	}

	return body;
}

function buildTaskRequestBody(
	title?: string,
	workspace?: string,
	status?: string,
	description?: string,
	tags?: string[],
	people?: string[],
): any {
	const body: any = {};

	if (title) body.title = title;
	if (workspace) body.workspace = workspace;
	if (status) body.status = status;
	if (description) body.description = description;
	if (tags?.length) body.tags = tags;
	if (people?.length) body.people = people;

	return body;
}

export class RogerRoger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RogerRoger',
		name: 'rogerRoger',
		icon: 'file:rogerroger.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with RogerRoger API for Person, Organization and Task resources',
		defaults: {
			name: 'RogerRoger',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'rogerRogerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: '',
				noDataExpression: true,
				options: [
					{ name: 'Person', value: RESOURCES.PERSON },
					{ name: 'Organization', value: RESOURCES.ORGANIZATION },
					{ name: 'Task', value: RESOURCES.TASK },
				]
			},
			...this.generateOperationProperties(),
			...this.generateIdProperties(),
			...this.generatePersonProperties(),
			...this.generateOrganizationProperties(),
			...this.generateTaskProperties(),
			...this.generateGetManyOptions(),
		],
	};

	private generateOperationProperties() {
		return Object.values(RESOURCES).map(resource => ({
			displayName: 'Operation',
			name: 'operation',
			type: 'options' as const,
			noDataExpression: true,
			displayOptions: {
				show: { resource: [resource] },
			},
			options: generateOperationOptions(resource),
			default: '',
		}));
	}

	private generateIdProperties() {
		return [
			{
				displayName: 'Person ID',
				name: 'personId',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.UPDATE, OPERATIONS.DELETE, OPERATIONS.GET],
						resource: [RESOURCES.PERSON],
					},
				},
				default: '',
				placeholder: 'Enter person ID',
				required: true,
				description: 'The ID of the person to update, delete, or retrieve',
			},
			{
				displayName: 'Organization ID',
				name: 'organizationId',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.UPDATE, OPERATIONS.DELETE, OPERATIONS.GET],
						resource: [RESOURCES.ORGANIZATION],
					},
				},
				default: '',
				placeholder: 'Enter organization ID',
				required: true,
				description: 'The ID of the organization to update or delete',
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.UPDATE, OPERATIONS.DELETE, OPERATIONS.GET],
						resource: [RESOURCES.TASK],
					},
				},
				default: '',
				placeholder: 'Enter task ID',
				required: true,
				description: 'The ID of the task to update or delete',
			},
		];
	}

	private generatePersonProperties() {
		const contactFieldOptions = [
			{
				displayName: 'Organizations',
				name: 'organizations',
				type: 'multiOptions' as const,
				typeOptions: {
					loadOptionsMethod: 'getOrganizations',
				},
				default: [],
				description: 'Organizations this person belongs to',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'multiOptions' as const,
				typeOptions: {
					loadOptionsMethod: 'getTags',
				},
				default: [],
				description: 'Tags associated with this person',
			},
			{
				displayName: 'Segments',
				name: 'segments',
				type: 'multiOptions' as const,
				typeOptions: {
					loadOptionsMethod: 'getSegments',
				},
				default: [],
				description: 'Segments associated with this person',
			},
			{
				displayName: 'Email Addresses',
				name: 'emailAddresses',
				type: 'string' as const,
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: 'name@email.com',
				description: 'Enter one or more email addresses',
			},
			{
				displayName: 'Phone Numbers',
				name: 'phoneNumbers',
				type: 'string' as const,
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: '+1-555-123-4567',
				description: 'Enter one or more phone numbers',
			},
			{
				displayName: 'LinkedIn ID',
				name: 'linkedinId',
				type: 'string' as const,
				default: '',
				placeholder: 'Enter LinkedIn ID',
				description: 'LinkedIn identifier for the person',
			},
			{
				displayName: 'Job Title',
				name: 'jobTitle',
				type: 'string' as const,
				default: '',
				placeholder: 'Enter Job Title',
				description: 'Job title of the person',
			},
			{
				displayName: 'Customer ID',
				name: 'customerId',
				type: 'string' as const,
				default: '',
				placeholder: 'Enter Customer ID',
				description: 'Customer identifier for the person',
			},
			{
				displayName: 'Address',
				name: 'address',
				type: 'fixedCollection' as const,
				placeholder: 'Add Address',
				default: {},
				description: 'Address of the person',
				options: [
					{
						name: 'addressDetails',
						displayName: 'Address Details',
						values: [
							{
								displayName: 'Street',
								name: 'street',
								type: 'string' as const,
								default: '',
								placeholder: 'Enter street address',
								description: 'Street address',
							},
							{
								displayName: 'City',
								name: 'city',
								type: 'string' as const,
								default: '',
								placeholder: 'Enter city',
								description: 'City name',
							},
							{
								displayName: 'Postal Code',
								name: 'postalCode',
								type: 'string' as const,
								default: '',
								placeholder: 'Enter postal code',
							},
						],
					},
				],
			},
		];

		return [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.CREATE],
						resource: [RESOURCES.PERSON],
					},
				},
				default: '',
				placeholder: 'Enter first name',
				required: true,
			},
			{
				displayName: 'Surname',
				name: 'surname',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.CREATE],
						resource: [RESOURCES.PERSON],
					},
				},
				default: '',
				placeholder: 'Enter surname',
				required: true,
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection' as const,
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.PERSON],
						operation: [OPERATIONS.UPDATE],
					},
				},
				options: [
					{
						displayName: 'First Name',
						name: 'firstName',
						type: 'string' as const,
						default: '',
						placeholder: 'Enter first name',
						description: 'First name of the person',
					},
					{
						displayName: 'Surname',
						name: 'surname',
						type: 'string' as const,
						default: '',
						placeholder: 'Enter surname',
						description: 'Last name of the person',
					},
					...contactFieldOptions,
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection' as const,
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.PERSON],
						operation: [OPERATIONS.CREATE],
					},
				},
				options: contactFieldOptions,
			},
		];
	}

	private generateOrganizationProperties() {
		const organizationFieldOptions = [
			{
				displayName: 'People',
				name: 'people',
				type: 'multiOptions' as const,
				typeOptions: {
					loadOptionsMethod: 'getPeople',  // You need to implement this method
				},
				default: [],
				description: 'People associated with this organization',
			},
			{
				displayName: 'Website',
				name: 'website',
				type: 'string' as const,
				default: '',
				placeholder: 'https://example.com',
				description: 'Website URL of the organization',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string' as const,
				typeOptions: {
					rows: 4,  // Make it a text area for longer descriptions
				},
				default: '',
				placeholder: 'Enter organization description',
				description: 'Description of the organization',
			},
			{
				displayName: 'Customer ID',
				name: 'customerId',
				type: 'string' as const,
				default: '',
				placeholder: 'Enter Customer ID',
				description: 'Customer identifier for the organization',
			},
			{
				displayName: 'Chamber of Commerce Number',
				name: 'chamberOfCommerceNumber',
				type: 'string' as const,
				default: '',
				placeholder: 'Enter Chamber of Commerce Number',
				description: 'Chamber of Commerce registration number',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'multiOptions' as const,
				typeOptions: {
					loadOptionsMethod: 'getTags',
				},
				default: [],
				description: 'Tags associated with this organization',
			},
			{
				displayName: 'Segments',
				name: 'segments',
				type: 'multiOptions' as const,
				typeOptions: {
					loadOptionsMethod: 'getSegments',
				},
				default: [],
				description: 'Segments associated with this organization',
			},
			{
				displayName: 'Email Addresses',
				name: 'emailAddresses',
				type: 'string' as const,
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: 'name@email.com',
				description: 'Enter one or more email addresses',
			},
			{
				displayName: 'Phone Numbers',
				name: 'phoneNumbers',
				type: 'string' as const,
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: '+1-555-123-4567',
				description: 'Enter one or more phone numbers',
			},
			{
				displayName: 'Address',
				name: 'address',
				type: 'fixedCollection' as const,
				placeholder: 'Add Address',
				default: {},
				description: 'Address of the organization',
				options: [
					{
						name: 'addressDetails',
						displayName: 'Address Details',
						values: [
							{
								displayName: 'Street',
								name: 'street',
								type: 'string' as const,
								default: '',
								placeholder: 'Enter street address',
								description: 'Street address',
							},
							{
								displayName: 'City',
								name: 'city',
								type: 'string' as const,
								default: '',
								placeholder: 'Enter city',
								description: 'City name',
							},
							{
								displayName: 'Postal Code',
								name: 'postalCode',
								type: 'string' as const,
								default: '',
								placeholder: 'Enter postal code',
							},
							{
								displayName: 'Country',
								name: 'country',
								type: 'string' as const,
								default: 'NL',
								placeholder: 'NL',
								description: 'Country code',
							},
						],
					},
				],
			},
		];

		return [
			{
				displayName: 'Title',
				name: 'organizationName',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.CREATE],
						resource: [RESOURCES.ORGANIZATION],
					},
				},
				default: '',
				placeholder: 'Enter organization name',
				required: true,
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection' as const,
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.ORGANIZATION],
						operation: [OPERATIONS.CREATE],
					},
				},
				options: organizationFieldOptions,
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection' as const,
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.ORGANIZATION],
						operation: [OPERATIONS.UPDATE],
					},
				},
				options: [
					{
						displayName: 'Organization Name',
						name: 'organizationName',
						type: 'string' as const,
						default: '',
						placeholder: 'Enter organization name',
						description: 'Name of the organization',
					},
					...organizationFieldOptions,
				],
			},
		];
	}

	private generateTaskProperties() {
		return [
			{
				displayName: 'Title',
				name: 'taskTitle',
				type: 'string' as const,
				displayOptions: {
					show: {
						operation: [OPERATIONS.CREATE],
						resource: [RESOURCES.TASK],
					},
				},
				default: '',
				placeholder: 'Enter task title',
				required: true,
				description: 'Title of the task',
			},
			{
				displayName: 'Workspace Name or ID',
				name: 'workspace',
				type: 'options' as const,
				typeOptions: {
					loadOptionsMethod: 'getWorkspaces',
				},
				displayOptions: {
					show: {
						operation: [OPERATIONS.CREATE],
						resource: [RESOURCES.TASK],
					},
				},
				default: '',
				placeholder: 'Select a workspace',
				required: true,
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Column Name or ID',
				name: 'column',
				type: 'options' as const,
				typeOptions: {
					loadOptionsMethod: 'getColumns',
					loadOptionsDependsOn: ['workspace'],
				},
				displayOptions: {
					show: {
						operation: [OPERATIONS.CREATE],
						resource: [RESOURCES.TASK],
					},
				},
				default: '',
				placeholder: 'Select a column',
				required: true,
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection' as const,
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.TASK],
						operation: [OPERATIONS.CREATE],
					},
				},
				options: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string' as const,
						typeOptions: { rows: 4 },
						default: '',
						placeholder: 'Enter task description',
						description: 'Description of the task',
					},
					{
						displayName: 'Tags',
						name: 'tags',
						type: 'multiOptions' as const,
						typeOptions: {
							loadOptionsMethod: 'getTags',
						},
						default: [],
						description: 'Tags associated with this task',
					},
					{
						displayName: 'People',
						name: 'people',
						type: 'multiOptions' as const,
						typeOptions: {
							loadOptionsMethod: 'getPeople',
						},
						default: [],
						description: 'People associated with this task',
					},
				],
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection' as const,
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.TASK],
						operation: [OPERATIONS.UPDATE],
					},
				},
				options: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string' as const,
						default: '',
						placeholder: 'Enter task title',
						description: 'Title of the task',
					},
					{
						displayName: 'Status',
						name: 'taskStatus',
						type: 'fixedCollection' as const,
						default: {},
						description: 'Update the workspace and column of the task',
						options: [
							{
								name: 'statusDetails',
								displayName: 'Status Details',
								values: [
									{
										displayName: 'Workspace Name or ID',
										name: 'workspace',
										type: 'options' as const,
										typeOptions: {
											loadOptionsMethod: 'getWorkspaces',
										},
										default: '',
										placeholder: 'Select a workspace',
										description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
									},
									{
										displayName: 'Column Name or ID',
										name: 'column',
										type: 'options' as const,
										typeOptions: {
											loadOptionsMethod: 'getColumns',
											loadOptionsDependsOn: ['updateFields.taskStatus.statusDetails.workspace'],
										},
										default: '',
										placeholder: 'Select a column',
										description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
									},
								],
							},
						],
					},
				],
			},
		];
	}

	private generateGetManyOptions() {
		return [
			{
				displayName: 'Items Per Page',
				name: 'itemsPerPage',
				type: 'number' as const,
				required: true,
				default: 15,
				description: 'Number of items to retrieve per page',
				displayOptions: {
					show: {
						operation: [OPERATIONS.GET_MANY],
					},
				},
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number' as const,
				default: 1,
				description: 'Page number to retrieve',
				displayOptions: {
					show: {
						operation: [OPERATIONS.GET_MANY],
					},
				},
			},
		];
	}

	methods = {
		loadOptions: {
			async getPeople(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('rogerRogerApi');
					const people: INodePropertyOptions[] = [];
					let nextUrl: string | undefined = `${credentials.apiBaseUrl}/${ENDPOINTS[RESOURCES.PERSON]}`;

					while (nextUrl) {
						const requestOptions = createHttpRequestOptions(
							'GET',
							nextUrl,
							credentials.apiKey as string
						);

						const response = await this.helpers.httpRequest(requestOptions);
						const items = response.member || [];

						// Add people from current page
						items.forEach((person: any) => {
							people.push({
								name: `${person.givenName} ${person.familyName}`,
								value: person['@id'],
							});
						});

						// Check if there's a next page
						const nextPath = response.view?.next;
						nextUrl = nextPath ? (nextPath.startsWith('http') ? nextPath : `${credentials.apiBaseUrl}${nextPath}`) : undefined;
					}

					return people;

				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load people: ${error.message}`
					);
				}
			},

			async getSegments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('rogerRogerApi');
					const segments: INodePropertyOptions[] = [];
					let nextUrl: string | undefined = `${credentials.apiBaseUrl}/${ENDPOINTS[RESOURCES.SEGMENT]}`;

					while (nextUrl) {
						const requestOptions = createHttpRequestOptions(
							'GET',
							nextUrl,
							credentials.apiKey as string
						);

						const response = await this.helpers.httpRequest(requestOptions);
						const items = response.member || [];

						// Add segments from current page
						items.forEach((segment: any) => {
							segments.push({
								name: segment.title,
								value: segment['@id'],
							});
						});

						// Check if there's a next page
						const nextPath = response.view?.next;
						nextUrl = nextPath ? (nextPath.startsWith('http') ? nextPath : `${credentials.apiBaseUrl}${nextPath}`) : undefined;
					}

					return segments;

				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load segments: ${error.message}`
					);
				}
			},

			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('rogerRogerApi');
					const tags: INodePropertyOptions[] = [];
					let nextUrl: string | undefined = `${credentials.apiBaseUrl}/${ENDPOINTS[RESOURCES.TAG]}`;

					while (nextUrl) {
						const requestOptions = createHttpRequestOptions(
							'GET',
							nextUrl,
							credentials.apiKey as string
						);

						const response = await this.helpers.httpRequest(requestOptions);
						const items = response.member || [];

						// Add tags from current page
						items.forEach((tag: any) => {
							tags.push({
								name: tag.title,
								value: tag['@id'],
							});
						});

						// Check if there's a next page
						const nextPath = response.view?.next;
						nextUrl = nextPath ? (nextPath.startsWith('http') ? nextPath : `${credentials.apiBaseUrl}${nextPath}`) : undefined;
					}

					return tags;

				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load tags: ${error.message}`
					);
				}
			},

			async getOrganizations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('rogerRogerApi');
					const organizations: INodePropertyOptions[] = [];
					let nextUrl: string | undefined = `${credentials.apiBaseUrl}/${ENDPOINTS[RESOURCES.ORGANIZATION]}`;

					while (nextUrl) {
						const requestOptions = createHttpRequestOptions(
							'GET',
							nextUrl,
							credentials.apiKey as string
						);

						const response = await this.helpers.httpRequest(requestOptions);
						const items = response.member || [];

						// Add organizations from current page
						items.forEach((org: any) => {
							organizations.push({
								name: org.title,
								value: org['@id'],
							});
						});

						// Check if there's a next page
						const nextPath = response.view?.next;
						nextUrl = nextPath ? (nextPath.startsWith('http') ? nextPath : `${credentials.apiBaseUrl}${nextPath}`) : undefined;
					}

					return organizations;

				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load organizations: ${error.message}`
					);
				}
			},

			async getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('rogerRogerApi');
					const requestOptions = createHttpRequestOptions(
						'GET',
						`${credentials.apiBaseUrl}/workspaces`,
						credentials.apiKey as string
					);

					const response = await this.helpers.httpRequest(requestOptions);
					const workspaces = response.member || [];

					// Cache workspace columns
					workspaces.forEach((workspace: any) => {
						const workspaceKey = `/workspaces/${workspace.id}`;
						workspaceColumnsCache[workspaceKey] = workspace.columns?.map((column: any) => ({
							id: column.id,
							title: column.title,
						})) || [];
					});

					return workspaces.map((workspace: any) => ({
						name: workspace.title,
						value: `/workspaces/${workspace.id}`,
					}));
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load workspaces: ${error.message}`
					);
				}
			},

			async getColumns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const parameters = this.getNode().parameters;
				const isTaskUpdate = parameters.resource === RESOURCES.TASK && parameters.operation === OPERATIONS.UPDATE;

				const selectedWorkspace = isTaskUpdate
					? this.getCurrentNodeParameter('updateFields.taskStatus.statusDetails.workspace') as string
					: this.getCurrentNodeParameter('workspace') as string;

				if (!selectedWorkspace) {
					return [];
				}

				const columns = workspaceColumnsCache[selectedWorkspace] || [];

				return columns.map((column: any) => ({
					name: prettifyColumnTitle(column.title),
					value: `${selectedWorkspace}/columns/${column.id}`,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('rogerRogerApi') as CredentialInterface;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				let responseData;

				switch (operation) {
					case OPERATIONS.CREATE:
						responseData = await RogerRoger.handleCreate(this, resource, itemIndex, credentials);
						break;
					case OPERATIONS.UPDATE:
						responseData = await RogerRoger.handleUpdate(this, resource, itemIndex, credentials);
						break;
					case OPERATIONS.DELETE:
						responseData = await RogerRoger.handleDelete(this, resource, itemIndex, credentials);
						break;
					case OPERATIONS.GET:
						responseData = await RogerRoger.handleGet(this, resource, itemIndex, credentials);
						break;
					case OPERATIONS.GET_MANY:
						responseData = await RogerRoger.handleGetMany(this, resource, itemIndex, credentials);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown operation: ${operation}`,
							{ itemIndex }
						);
				}

				returnData.push({
					json: {
						resource,
						operation,
						...responseData,
					},
					pairedItem: itemIndex,
				});

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							...this.getInputData(itemIndex)[0].json,
						},
						pairedItem: itemIndex,
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
		}

		return [returnData];
	}

	static async handleGet(executeFunctions: IExecuteFunctions, resource: string, itemIndex: number, credentials: CredentialInterface): Promise<any> {
		const endpoint = ENDPOINTS[resource as keyof typeof ENDPOINTS];
		let resourceId: string;

		switch (resource) {
			case RESOURCES.PERSON:
				resourceId = executeFunctions.getNodeParameter('personId', itemIndex) as string;
				break;
			case RESOURCES.ORGANIZATION:
				resourceId = executeFunctions.getNodeParameter('organizationId', itemIndex) as string;
				break;
			case RESOURCES.TASK:
				resourceId = executeFunctions.getNodeParameter('taskId', itemIndex) as string;
				break;
			default:
				throw new NodeOperationError(executeFunctions.getNode(), `Unknown resource: ${resource}`);
		}

		const requestOptions = createHttpRequestOptions(
			'GET',
			`${credentials.apiBaseUrl}/${endpoint}/${resourceId}`,
			credentials.apiKey
		);

		try {
			return await executeFunctions.helpers.httpRequest(requestOptions);
		} catch (error) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Failed to get ${resource} "${resourceId}": ${error?.response?.data?.detail || error.message}`,
				{
					itemIndex,
					description: error?.response,
				}
			);
		}
	}

	static async handleGetMany(executeFunctions: IExecuteFunctions, resource: string, itemIndex: number, credentials: CredentialInterface): Promise<any> {
		const endpoint = ENDPOINTS[resource as keyof typeof ENDPOINTS];
		const itemsPerPage = executeFunctions.getNodeParameter('itemsPerPage', itemIndex) as number;
		const page = executeFunctions.getNodeParameter('page', itemIndex) as number | null;

		let nextUrl: string | undefined;

		if (page !== null && page !== undefined) {
			// If a specific page is set, construct the URL for that page
			nextUrl = `${credentials.apiBaseUrl}/${endpoint}?itemsPerPage=${itemsPerPage}&page=${page}`;
		} else {
			// If no specific page is set, start with the first page and loop
			nextUrl = `${credentials.apiBaseUrl}/${endpoint}?itemsPerPage=${itemsPerPage}`;
		}

		const allItems: any[] = [];
		let viewInfo: any = null;

		do {
			const requestOptions = createHttpRequestOptions(
				'GET',
				nextUrl,
				credentials.apiKey
			);

			try {
				const response = await executeFunctions.helpers.httpRequest(requestOptions);
				const items = response.member || [];
				allItems.push(...items);

				// Capture view information
				viewInfo = response.view || null;

				// Check if there's a next page
				const nextPath = response.view?.next;
				nextUrl = nextPath ? (nextPath.startsWith('http') ? nextPath : `${credentials.apiBaseUrl}${nextPath}`) : undefined;

				// If a specific page was requested, break after the first iteration
				if (page !== null && page !== undefined) {
					break;
				}
			} catch (error) {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`Failed to get many ${resource}: ${error?.response?.data?.detail || error.message}`,
					{
						itemIndex,
						description: error?.response,
					}
				);
			}
		} while (nextUrl);

		return { items: allItems, view: viewInfo };
	}

	static async handleCreate(executeFunctions: IExecuteFunctions, resource: string, itemIndex: number, credentials: CredentialInterface): Promise<any> {
		const endpoint = ENDPOINTS[resource as keyof typeof ENDPOINTS];
		let requestBody: any;

		switch (resource) {
			case RESOURCES.PERSON:
				requestBody = RogerRoger.buildPersonCreateBody(executeFunctions, itemIndex);
				break;
			case RESOURCES.ORGANIZATION:
				requestBody = RogerRoger.buildOrganizationCreateBody(executeFunctions, itemIndex);
				break;
			case RESOURCES.TASK:
				requestBody = RogerRoger.buildTaskCreateBody(executeFunctions, itemIndex);
				break;
			default:
				throw new NodeOperationError(executeFunctions.getNode(), `Unknown resource: ${resource}`);
		}

		const requestOptions = createHttpRequestOptions(
			'POST',
			`${credentials.apiBaseUrl}/${endpoint}`,
			credentials.apiKey,
			requestBody
		);

		return await executeFunctions.helpers.httpRequest(requestOptions);
	}

	static async handleUpdate(executeFunctions: IExecuteFunctions, resource: string, itemIndex: number, credentials: CredentialInterface): Promise<any> {
		const endpoint = ENDPOINTS[resource as keyof typeof ENDPOINTS];
		let resourceId: string;
		let requestBody: any;

		switch (resource) {
			case RESOURCES.PERSON:
				resourceId = executeFunctions.getNodeParameter('personId', itemIndex) as string;
				requestBody = this.buildPersonUpdateBody(executeFunctions, itemIndex);
				break;
			case RESOURCES.ORGANIZATION:
				resourceId = executeFunctions.getNodeParameter('organizationId', itemIndex) as string;
				requestBody = this.buildOrganizationUpdateBody(executeFunctions, itemIndex);
				break;
			case RESOURCES.TASK:
				resourceId = executeFunctions.getNodeParameter('taskId', itemIndex) as string;
				requestBody = this.buildTaskUpdateBody(executeFunctions, itemIndex);
				break;
			default:
				throw new NodeOperationError(executeFunctions.getNode(), `Unknown resource: ${resource}`);
		}

		const requestOptions = createHttpRequestOptions(
			'PATCH',
			`${credentials.apiBaseUrl}/${endpoint}/${resourceId}`,
			credentials.apiKey,
			requestBody
		);

		try {
			return await executeFunctions.helpers.httpRequest(requestOptions);
		} catch (error) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Failed to update ${resource} "${resourceId}": ${error?.response?.data?.detail || error.message}`,
				{
					itemIndex,
					description: error?.response,
				}
			);
		}
	}

	static async handleDelete(executeFunctions: IExecuteFunctions, resource: string, itemIndex: number, credentials: CredentialInterface): Promise<any> {
		const endpoint = ENDPOINTS[resource as keyof typeof ENDPOINTS];
		let resourceId: string;

		switch (resource) {
			case RESOURCES.PERSON:
				resourceId = executeFunctions.getNodeParameter('personId', itemIndex) as string;
				break;
			case RESOURCES.ORGANIZATION:
				resourceId = executeFunctions.getNodeParameter('organizationId', itemIndex) as string;
				break;
			case RESOURCES.TASK:
				resourceId = executeFunctions.getNodeParameter('taskId', itemIndex) as string;
				break;
			default:
				throw new NodeOperationError(executeFunctions.getNode(), `Unknown resource: ${resource}`);
		}

		const requestOptions = createHttpRequestOptions(
			'DELETE',
			`${credentials.apiBaseUrl}/${endpoint}/${resourceId}`,
			credentials.apiKey
		);

		return await executeFunctions.helpers.httpRequest(requestOptions);
	}

	static buildPersonCreateBody(executeFunctions: IExecuteFunctions, itemIndex: number): any {
		const name = executeFunctions.getNodeParameter('name', itemIndex) as string;
		const surname = executeFunctions.getNodeParameter('surname', itemIndex) as string;
		const additionalFields = executeFunctions.getNodeParameter('additionalFields', itemIndex, {}) as {
			emailAddresses?: string[];
			phoneNumbers?: string[];
			linkedinId?: string;
			jobTitle?: string;
			customerId?: string;
			organizations?: string[];
			tags?: string[];
			segments?: string[];
			address?: {
				addressDetails?: {
					street?: string;
					city?: string;
					postalCode?: string;
				};
			};
		};

		return buildPersonRequestBody(
			name,
			surname,
			additionalFields.emailAddresses,
			additionalFields.phoneNumbers,
			additionalFields.address?.addressDetails,
			additionalFields.linkedinId,
			additionalFields.jobTitle,
			additionalFields.customerId,
			additionalFields.organizations,
			additionalFields.tags,
			additionalFields.segments
		);
	}

	static buildPersonUpdateBody(executeFunctions: IExecuteFunctions, itemIndex: number): any {
		const updateFields = executeFunctions.getNodeParameter('updateFields', itemIndex, {}) as {
			firstName?: string;
			surname?: string;
			emailAddresses?: string[];
			phoneNumbers?: string[];
			linkedinId?: string;
			jobTitle?: string;
			customerId?: string;
			organizations?: string[];
			tags?: string[];
			segments?: string[];
			address?: {
				addressDetails?: {
					street?: string;
					city?: string;
					postalCode?: string;
				};
			};
		};

		return buildPersonRequestBody(
			updateFields.firstName,
			updateFields.surname,
			updateFields.emailAddresses,
			updateFields.phoneNumbers,
			updateFields.address?.addressDetails,
			updateFields.linkedinId,
			updateFields.jobTitle,
			updateFields.customerId,
			updateFields.organizations,
			updateFields.tags,
			updateFields.segments
		);
	}

	static buildOrganizationCreateBody(executeFunctions: IExecuteFunctions, itemIndex: number): any {
		const organizationName = executeFunctions.getNodeParameter('organizationName', itemIndex) as string;
		const additionalFields = executeFunctions.getNodeParameter('additionalFields', itemIndex, {}) as {
			website?: string;
			description?: string;
			emailAddresses?: string[];
			phoneNumbers?: string[];
			customerId?: string;
			chamberOfCommerceNumber?: string;
			tags?: string[];
			segments?: string[];
			people?: string[],
			address?: {
				addressDetails?: {
					street?: string;
					city?: string;
					postalCode?: string;
					country?: string;
				};
			};
		};

		return buildOrganizationRequestBody(
			organizationName,
			additionalFields.website,
			additionalFields.description,
			additionalFields.emailAddresses,
			additionalFields.phoneNumbers,
			additionalFields.customerId,
			additionalFields.chamberOfCommerceNumber,
			additionalFields.tags,
			additionalFields.segments,
			additionalFields.people,
			additionalFields.address?.addressDetails
		);
	}

	static buildOrganizationUpdateBody(executeFunctions: IExecuteFunctions, itemIndex: number): any {
		const updateFields = executeFunctions.getNodeParameter('updateFields', itemIndex, {}) as {
			organizationName?: string;
			website?: string;
			description?: string;
			emailAddresses?: string[];
			phoneNumbers?: string[];
			customerId?: string;
			chamberOfCommerceNumber?: string;
			tags?: string[];
			segments?: string[];
			people?: string[];
			address?: {
				addressDetails?: {
					street?: string;
					city?: string;
					postalCode?: string;
					country?: string;
				};
			};
		};

		return buildOrganizationRequestBody(
			updateFields.organizationName,
			updateFields.website,
			updateFields.description,
			updateFields.emailAddresses,
			updateFields.phoneNumbers,
			updateFields.customerId,
			updateFields.chamberOfCommerceNumber,
			updateFields.tags,
			updateFields.segments,
			updateFields.people,
			updateFields.address?.addressDetails
		);
	}

	static buildTaskCreateBody(executeFunctions: IExecuteFunctions, itemIndex: number): any {
		const taskTitle = executeFunctions.getNodeParameter('taskTitle', itemIndex) as string;
		const workspace = executeFunctions.getNodeParameter('workspace', itemIndex) as string;
		const column = executeFunctions.getNodeParameter('column', itemIndex) as string;
		const additionalFields = executeFunctions.getNodeParameter('additionalFields', itemIndex, {}) as {
			description?: string;
			tags?: string[];
			people?: string[];
		};

		return buildTaskRequestBody(
			taskTitle,
			workspace,
			column,
			additionalFields.description,
			additionalFields.tags,
			additionalFields.people
		);
	}

	static buildTaskUpdateBody(executeFunctions: IExecuteFunctions, itemIndex: number): any {
		const updateFields = executeFunctions.getNodeParameter('updateFields', itemIndex, {}) as {
			title?: string;
			taskStatus?: {
				statusDetails?: {
					workspace?: string;
					column?: string;
				};
			};
			description?: string;
			tags?: string[];
			people?: string[];
		};

		const { workspace, column } = updateFields.taskStatus?.statusDetails || {};

		return buildTaskRequestBody(
			updateFields.title,
			workspace,
			column,
			updateFields.description,
			updateFields.tags,
			updateFields.people
		);
	}
}
