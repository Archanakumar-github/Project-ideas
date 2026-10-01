import { describe, expect, it } from 'vitest'
import { parseDate, parseDays, parseHeightCm, parseMacro, parseMacroSplit, parseMinutes, parseMl, parsePerWeek, parseTime, parseTimeRange, parseWeightKg, weekdayKey } from './values'

describe('value parsers', () => {
  it('reads heights in any common unit', () => {
    expect(parseHeightCm('168 cm')).toBe(168)
    expect(parseHeightCm('1.75 m')).toBeCloseTo(175)
    expect(parseHeightCm(`5'9"`)).toBeCloseTo(175.26, 1)
    expect(parseHeightCm('5 ft 11 in')).toBeCloseTo(180.34, 1)
    expect(parseHeightCm('69 inches')).toBeCloseTo(175.26, 1)
    expect(parseHeightCm('172')).toBe(172)
  })

  it('reads weights in kg, lb and stone', () => {
    expect(parseWeightKg('74 kg')).toBe(74)
    expect(parseWeightKg('72,5 kg')).toBe(72.5)
    expect(parseWeightKg('212 lbs')).toBeCloseTo(96.16, 1)
    expect(parseWeightKg('11 st 4 lb')).toBeCloseTo(71.67, 1)
    expect(parseWeightKg('180', true)).toBeCloseTo(81.65, 1)
  })

  it('reads clock times and ranges, including overnight', () => {
    expect(parseTime('6:15')).toBe('06:15')
    expect(parseTime('10 PM')).toBe('22:00')
    expect(parseTime('6.30am')).toBe('06:30')
    expect(parseTime('noon')).toBe('12:00')
    expect(parseTime('16:8 fasting')).toBeUndefined()
    expect(parseTimeRange('09:00–17:30')).toEqual(['09:00', '17:30'])
    expect(parseTimeRange('9am - 5pm')).toEqual(['09:00', '17:00'])
    expect(parseTimeRange('8-5')).toEqual(['08:00', '17:00'])
    expect(parseTimeRange('22:30 to 06:15')).toEqual(['22:30', '06:15'])
  })

  it('expands day lists and ranges', () => {
    expect(parseDays('Monday, Wednesday and Friday')).toEqual(['mon', 'wed', 'fri'])
    expect(parseDays('Mon - Fri')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri'])
    expect(parseDays('Mon/Wed/Fri')).toEqual(['mon', 'wed', 'fri'])
    expect(parseDays('weekends')).toEqual(['sat', 'sun'])
    expect(parseDays('every day')).toHaveLength(7)
    expect(weekdayKey('Thursday')).toBe('thu')
    expect(weekdayKey('Thursday workout')).toBeUndefined()
    expect(parsePerWeek('4x per week')).toBe(4)
    expect(parsePerWeek('3 days a week')).toBe(3)
  })

  it('reads durations, fluids and macros', () => {
    expect(parseMinutes('50 minutes')).toBe(50)
    expect(parseMinutes('1 hour')).toBe(60)
    expect(parseMinutes('1h15')).toBe(75)
    expect(parseMinutes('60-75 min')).toBe(68)
    expect(parseMl('2.5 L')).toBe(2500)
    expect(parseMl('8 glasses')).toBe(2000)
    expect(parseMl('100 oz')).toBe(2957)
    expect(parseMacro('130 g')).toEqual({ grams: 130 })
    expect(parseMacro('1.8 g/kg')).toEqual({ perKg: 1.8 })
    expect(parseMacro('30%')).toEqual({ pct: 30 })
    expect(parseMacroSplit('40/30/30 (C/P/F)')).toEqual({ carbs: 40, protein: 30, fat: 30 })
    expect(parseMacroSplit('protein 30%, carbs 45%, fat 25%')).toEqual({ protein: 30, carbs: 45, fat: 25 })
  })

  it('reads dates', () => {
    const now = new Date(2026, 9, 1)
    expect(parseDate('2027-03-31', now)).toBe('2027-03-31')
    expect(parseDate('31 March 2027', now)).toBe('2027-03-31')
    expect(parseDate('in 12 weeks', now)).toBe('2026-12-24')
  })
})
