import { nanoid } from 'nanoid'

export function generateTaskId(): string {
  return `tsk_${nanoid(8)}`
}

export function generateActivityId(): string {
  return `act_${nanoid(8)}`
}

export function generateId(): string {
  return nanoid(8)
}
