/// <reference types="cypress" />

describe('KPIs Page Tests', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000')
    cy.contains('.nav a.nav-link', 'KPIs').click()
  })

  it('should load simulations', () => {
    
  })
})
