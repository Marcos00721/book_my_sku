// Bounded fixture using the documented public geography contract and real codes.
export async function mockGeography(page) {
  const countries = [
    {
      code: 'US',
      name: 'United States',
      stateLabel: 'State',
      stateRequirement: 'required',
      postalRequirement: 'required',
    },
    {
      code: 'IN',
      name: 'India',
      stateLabel: 'State',
      stateRequirement: 'required',
      postalRequirement: 'required',
    },
  ]
  await page.route('**/api/v1/reference/**', (route) => {
    const pathname = new URL(route.request().url()).pathname
    const country = countries.find((item) =>
      pathname.includes(`/countries/${item.code}/states`),
    )
    return route.fulfill({
      json: {
        data: country
          ? {
              version: '2026-10-21.1',
              country,
              states:
                country.code === 'US'
                  ? [{ code: 'US-TX', name: 'Texas' }]
                  : [{ code: 'IN-RJ', name: 'Rajasthan' }],
            }
          : { version: '2026-10-21.1', countries },
      },
    })
  })
}
