import { useEffect, useId, useRef, useState } from 'react'
import { parseCount } from '../../lib/parseCount'

/** A whole-number text field. Calls onChange only with valid numbers; reports validity. */
export function CountField(props: {
  label: string
  value: number
  onChange(n: number): void
  onValidity?(valid: boolean): void
  hideLabel?: boolean
}) {
  const id = useId()
  const [text, setText] = useState(String(props.value))
  const [invalid, setInvalid] = useState(false)

  // Follow the value only when it changes from outside; never on mount, which could
  // overwrite what the user has already typed if effects run late.
  // A field that disappears (row removed, section hidden) must not keep blocking a save.
  const onValidity = useRef(props.onValidity)
  onValidity.current = props.onValidity
  useEffect(() => () => onValidity.current?.(true), [])

  const lastValue = useRef(props.value)
  useEffect(() => {
    if (lastValue.current === props.value) return
    lastValue.current = props.value
    setText((t) => (parseCount(t) === props.value ? t : String(props.value)))
  }, [props.value])

  return (
    <div className={`count-field${invalid ? ' is-invalid' : ''}`}>
      <label htmlFor={id} className={props.hideLabel ? 'visually-hidden' : undefined}>{props.label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseCount(e.target.value)
          setInvalid(n === null)
          props.onValidity?.(n !== null)
          if (n !== null) props.onChange(n)
        }}
      />
      {invalid && <span className="field-error">Enter a whole number</span>}
    </div>
  )
}
