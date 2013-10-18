```js
// config:
{
	packages: [
		{
			name: 'pkgA',
			location: 'path/to/pkgA',
			main: 'main/main-module-file',
			config: {
				// do we need to nest this stuff in 'config'?
				// can they just be pkgA properties?
				packages: {
					// pkgC1.0 is declared at the top level
					pkgC: 'pkgC1.0',
					// pkgD is declared inline (not shared)
					pkgD: 'pkgD' // redundant. no need to specify this
				},
				plugins: {
					css: { cssDeferLoad: false },
					link: { fixSchemalessUrls: 'https:' },
					i18n: { locale: 'en-us' }
				}
			}
		},
		{
			name: 'pkgB',
			location: 'path/to/pkgB',
			main: 'main',
			config: {
				packages: {
					// pkgC1.0 is declared at the top level
					pkgC: 'pkgC1.0'
				}
			}
		},
		{
			name: 'pkgZ',
			location: 'path/to/pkgB',
			main: 'main',
			config: {
				packages: {
					// look! I use pkgC1.1, not pkgC1.0
					pkgC: 'pkgC1.1'
				}
			}
		},
		{
			name: 'pkgD',
			location: 'path/to/pkgD',
			main: 'main'
		},
		{
			name: 'pkgC1.0',
			location: 'path/to/pkgC1.0',
			main: 'main'
			config: {
				paths: { jquery: 'jQuery-1.8.2.min' }
			}
		},
		{
			name: 'pkgC1.1',
			location: 'path/to/pkgC1.1',
			main: 'main'
			config: {
				paths: { jquery: 'jQuery-1.7.1.min' }
			}
		}
	]
}
```
