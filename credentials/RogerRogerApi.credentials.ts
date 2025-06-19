import {
	IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RogerRogerApi implements ICredentialType {
  name = 'rogerRogerApi';
  displayName = 'RogerRoger API';
	documentationUrl = 'https://developer.rogerroger.io';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
			typeOptions: { password: true },
      default: '',
      placeholder: 'Your RogerRoger API Key',
    },
		{
      displayName: 'API Base URL',
      name: 'apiBaseUrl',
      type: 'string',
      default: 'https://api.rogerroger.io',
      placeholder: 'https://api.rogerroger.io',
      description: 'The base URL for the RogerRoger API',
    },
  ];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}'
			}

		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiBaseUrl}}',
			url: '/people',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'message',
					value: 'JWT Token not found',
					message: 'Invalid or missing API key',
				},
			},
		],
	};
}
