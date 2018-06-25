// @flow

import React, { Component, type ComponentType, type ElementRef } from 'react';

import type { SchemaProperty } from '../types';
import prefixer from '../helpers/prefixer';
import isPromise from '../helpers/isPromise';
import debounce from '../helpers/debounce';
import isMemoizeObject from '../helpers/isMemoizeObject';
import memoize, { clearMemoize, type MemoizableResult } from '../helpers/memoize';
import { SubmittedContext, FormContext, FieldGroupContext, FieldContext } from '../contexts';

export type Props = {
  name: string,
  type?: string,
  error?: string,
  onFocus?: Function,
  onChange?: Function
};

type CombinedProps = Props & {
  object: Object,
  schema: Object,
  contextPrefix: string,
  onFieldGroupChange: Function,
  onFormValidate: Function,
  submitted: boolean
};

const SUCCESS_ASYNC_VALIDATION = '__success_async__';

export class Field extends Component<CombinedProps> {
  target: Object;
  touched: ?boolean;
  incomingError: ?string;

  asyncError: ?string;
  validatingPromise: ?Promise<?string>;
  static validatingErrorMessage = 'Validating';

  /*
   * Component binding
   */

  static connectedComponents: { [_: string]: ComponentType<*> } = {};

  /*
   * Getters
   */

  getObjectValue() {
    const { name, object } = this.props;
    return object[name];
  }

  getSchemaProperty(): SchemaProperty {
    const { name, schema, type } = this.props;

    const property = schema[name];
    if (!property && !type) this.warnMissingSchemaProperty();

    return property || {};
  }

  getType(): string {
    return this.props.type || this.getSchemaProperty().type || 'text';
  }

  getPrefixedName() {
    const { contextPrefix, name } = this.props;
    return prefixer(contextPrefix, name);
  }

  getComponent(): ComponentType<*> {
    return Field.connectedComponents[this.getType()] || this.throwMissingTypeConnection();
  }

  getValue(incomingValue?: any) {
    return incomingValue !== undefined ? incomingValue : this.getTargetValue();
  }

  getTargetValue(): any {
    if (this.target.type === 'checkbox') return this.target.checked;
    return this.target.value;
  }

  getTargetValidationMessage(): ?string {
    return (this.target || {}).validationMessage;
  }

  runErrorPromise(response: any) {
    this.validatingPromise = response;

    const handlePromiseResolve = error => {
      if (this.validatingPromise === response) {
        this.validatingPromise = null;
        this.asyncError = error;
        this.forceUpdate();
      }
    };

    response
      .then(error => handlePromiseResolve(error || SUCCESS_ASYNC_VALIDATION))
      .catch(error => handlePromiseResolve(error.message));

    return Field.validatingErrorMessage;
  }

  runErrorMemoizeObject(response: Object): MemoizableResult {
    if (!response.callback) throw new Error('Undefined `callback` in validation function object response');

    if (response.debounce) return debounce(this, response.callback, response.debounce);
    if (response.memoize) return memoize(this, response.callback);

    throw new Error('Invalid validation object response - please set `debounce: timeoutMillis` or `memoize: true`');
  }

  runErrorFunction(callback: Function) {
    const { name, object } = this.props;
    return callback.bind(object)(object, name);
  }

  getSchemaError(): ?string | Promise<?string> {
    let error = this.getSchemaProperty().error;
    if (!error) return;

    if (typeof error === 'string') error = this.props.object[error];
    if (typeof error === 'function') error = this.runErrorFunction(error);
    if (isMemoizeObject(error)) error = this.runErrorMemoizeObject(error);
    if (isPromise(error)) this.runErrorPromise(error);

    return error;
  }

  getError(value?: any): ?any {
    if (this.asyncError) {
      const error = this.asyncError;
      this.asyncError = null;
      return error === SUCCESS_ASYNC_VALIDATION ? null : error;
    }

    if (this.props.error) return this.props.error;
    return this.incomingError || this.getTargetValidationMessage() || this.getSchemaError();
  }

  /*
   * Setters
   */

  setValue(incomingValue: ?any) {
    const { name, onFieldGroupChange } = this.props;
    onFieldGroupChange(name, this.getValue(incomingValue));
  }

  setBrowserCustomValidity(message?: ?string): void {
    if (!this.target) return;

    const targets = Array.isArray(this.target) ? this.target : [this.target];
    targets.forEach(element => {
      if (element.setCustomValidity) element.setCustomValidity(message || '');
    });
  }

  clearBrowserCustomValidity() {
    this.setBrowserCustomValidity();
  }

  /*
   * Dispatchers
   */
  dispatchValidation(error: ?string) {
    this.props.onFormValidate(this.getPrefixedName(), error);
  }

  /*
   * Actions
   */

  touch() {
    this.touched = true;
  }

  touchAndRender() {
    const wasTouched = this.touched;
    this.touch();

    if (!wasTouched) this.forceUpdate();
  }

  validate(incomingError?: any): ?string {
    this.validatingPromise = null;
    this.clearBrowserCustomValidity();

    this.incomingError = incomingError;
    const error = this.getError();

    this.setBrowserCustomValidity(error);
    this.dispatchValidation(error);

    return error;
  }

  /*
   * Handlers
   */

  handleMount = (target: Object) => {
    this.target = target;
    this.forceUpdate();
  };

  handleFocus = (event?: Event) => {
    this.target = (event || this).target;
    this.touchAndRender();

    if (this.props.onFocus) this.props.onFocus(event);
  };

  handleChange = (event?: Event, value?: any, error?: any) => {
    this.target = (event || this).target;
    this.setValue(value);
    this.touch();

    if (this.props.onChange) this.props.onChange(event);
  };

  /*
   * Lifecycle
   */

  componentWillUnmount() {
    this.dispatchValidation();
    clearMemoize(this);
  }

  render() {
    let error = this.validate();

    // Avoid rerenderd when changing among null, false, undefined, 0 and ''
    if (!error || (typeof error === 'string' && error === '')) error = null;

    const { name, submitted, ...otherProps } = this.props;
    delete otherProps.object;
    delete otherProps.schema;
    delete otherProps.contextPrefix;
    delete otherProps.onFieldGroupChange;
    delete otherProps.onFormValidate;

    return (
      <FieldContext.Provider value={{ name }}>
        {React.createElement(this.getComponent(), {
          ...this.getSchemaProperty(),
          ...otherProps,
          name: this.getPrefixedName(),
          value: this.getObjectValue() || '',
          error,
          validating: this.validatingPromise ? this.validatingPromise : undefined,
          touched: this.touched || submitted,
          onMount: this.handleMount,
          onFocus: this.handleFocus,
          onChange: this.handleChange
        })}
      </FieldContext.Provider>
    );
  }

  /*
   * Errors
   */

  warnMissingSchemaProperty() {
    const name = this.props.name;
    const constructor = this.props.object.constructor.name;
    console.warn(`Undefined property "${name}" in schema for "${constructor}" instance`);
  }

  throwMissingTypeConnection() {
    const type = this.getType();
    const name = this.props.name;
    const constructor = this.props.object.constructor.name;
    throw new Error(`Missing "${type}" connection requested for property "${name}" in "${constructor}" instance`);
  }
}

export default (props: Props) => (
  <FormContext.Consumer>
    {({ onFormValidate }) => (
      <FieldGroupContext.Consumer>
        {fieldGroupProps => (
          <SubmittedContext.Consumer>
            {submitted => (
              <Field onFormValidate={onFormValidate} {...fieldGroupProps} {...props} submitted={submitted} />
            )}
          </SubmittedContext.Consumer>
        )}
      </FieldGroupContext.Consumer>
    )}
  </FormContext.Consumer>
);

export function connectField(type: string, component: ComponentType<*>): void {
  Field.connectedComponents[type] = component;
}
