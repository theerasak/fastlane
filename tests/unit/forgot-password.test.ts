import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must use vi.hoisted so the mock factory is available when vi.mock is hoisted
const mockSendMail = vi.hoisted(() => vi.fn())

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}))

const { sendPasswordResetEmail } = await import('@/lib/email')

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    mockSendMail.mockReset()
    mockSendMail.mockResolvedValue({})
  })

  it('calls sendMail exactly once', async () => {
    await sendPasswordResetEmail('user@example.com', 'http://localhost:3000/reset-password/abc')
    expect(mockSendMail).toHaveBeenCalledTimes(1)
  })

  it('sends to the correct recipient', async () => {
    await sendPasswordResetEmail('target@example.com', 'http://localhost:3000/reset-password/tok')
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'target@example.com' })
    )
  })

  it('uses a subject mentioning password', async () => {
    await sendPasswordResetEmail('a@b.com', 'http://localhost:3000/reset-password/x')
    const { subject } = mockSendMail.mock.calls[0][0]
    expect(subject).toMatch(/password/i)
  })

  it('includes the reset URL in the plain-text body', async () => {
    const url = 'http://localhost:3000/reset-password/abc123token'
    await sendPasswordResetEmail('a@b.com', url)
    const { text } = mockSendMail.mock.calls[0][0]
    expect(text).toContain(url)
  })

  it('includes the reset URL in the HTML body', async () => {
    const url = 'http://localhost:3000/reset-password/abc123token'
    await sendPasswordResetEmail('a@b.com', url)
    const { html } = mockSendMail.mock.calls[0][0]
    expect(html).toContain(url)
  })

  it('mentions 1-hour expiry in the plain-text body', async () => {
    await sendPasswordResetEmail('a@b.com', 'http://x.com')
    const { text } = mockSendMail.mock.calls[0][0]
    expect(text).toMatch(/1 hour/i)
  })

  it('propagates SMTP errors to the caller', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'))
    await expect(
      sendPasswordResetEmail('a@b.com', 'http://x.com')
    ).rejects.toThrow('SMTP connection refused')
  })
})
