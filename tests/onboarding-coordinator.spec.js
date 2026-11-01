import { expect, test } from '@playwright/test'
import { createOnboardingCoordinator } from '../src/services/onboardingCoordinator'

test('Finish reconciles a committed save with a lost response and stops before subscription consent', async () => {
  let setup = { revision:0,complete:false,locked:false,industry:'',address:{} }
  const calls = []
  const coordinator = createOnboardingCoordinator({
    actorId:'actor-a',currentActorId:() => 'actor-a',withLock:async (_key,task) => task(),refreshPermissions:async () => {},
    request:async (method,path,body) => {
      calls.push({ method,path,body })
      if (method === 'GET' && path === '/onboarding/setup') return structuredClone(setup)
      if (method === 'GET' && path === '/onboarding/journey') return { actorId:'actor-a',setup,nextAction:setup.complete ? 'review_and_start' : 'complete_company' }
      if (method === 'PATCH') { setup = { ...setup,...body,revision:1 }; delete setup.expectedRevision; throw Object.assign(new Error('Response lost'),{status:503}) }
      if (path === '/onboarding/setup/complete') { expect(body).toEqual({expectedRevision:1}); setup = { ...setup,revision:2,complete:true }; return setup }
      throw new Error(`Unexpected request: ${method} ${path}`)
    },
  })
  await coordinator.load()
  coordinator.edit({ industry:'Education',address:{line1:'1 School Road',city:'Jaipur',country:'IN',stateCode:'IN-RJ',postalCode:'302001'} })
  const result = await coordinator.finish()
  expect(result.nextAction).toBe('review_and_start')
  expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(1)
  expect(calls.some(call => /checkout|billing\/start/.test(call.path))).toBe(false)
})

test('only explicit editing can reopen completed unlocked company details and account changes stop writes', async () => {
  let actor = 'actor-a'
  let setup = { revision:4,complete:true,locked:false,industry:'Education' }
  const writes = []
  const options = {
    actorId:actor,currentActorId:() => actor,withLock:async (_key,task) => task(),refreshPermissions:async () => {},
    request:async (method,_path,body) => { if (method === 'GET') return setup; writes.push(body); setup = { ...setup,...body,revision:5,complete:false }; return setup },
  }
  const ordinary = createOnboardingCoordinator(options)
  await ordinary.load()
  expect(() => ordinary.edit({industry:'Manufacturing'})).toThrow('SETUP_COMPLETED')
  const explicitEdit = createOnboardingCoordinator({...options,allowCompletedEdits:true})
  await explicitEdit.load()
  explicitEdit.edit({industry:'Manufacturing'})
  await explicitEdit.save()
  expect(writes).toEqual([{expectedRevision:4,industry:'Manufacturing'}])
  actor = 'actor-b'
  expect(() => explicitEdit.edit({industry:'Another draft'})).toThrow('ACCOUNT_CHANGED')
  expect(writes).toHaveLength(1)
})
