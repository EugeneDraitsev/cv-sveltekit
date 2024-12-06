/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				constant: '#d694f9',
				declaration: '#FFC66D',
				string: '#a4c591',
				identifier: '#D1D1D1',
				keyword: '#CC7832',
				number: '#9fd6ff',
				background: '#424242',
				'base-100': '#121212',
				'base-200': '#1e1e1e',
				primary: '#FFC66D',
				secondary: '#d694f9'
			},
			borderColor: {
				DEFAULT: '#484848' // Replace this with your desired default color
			}
			// colors: {
			// 	constant: '#871094',
			// 	declaration: '#CC7832',
			// 	string: '#067d17',
			// 	identifier: '#2b2d30',
			// 	keyword: '#CC7832',
			// 	number: '#1750eb',
			// 	background: '#424242',
			// 	'base-100': 'white',
			// 	'base-200': '#fefefe',
			// 	primary: '#CC7832',
			// 	secondary: '#d694f9'
			// }
		}
	},
	plugins: []
};
