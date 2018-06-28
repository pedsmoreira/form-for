import React from 'react';
import { mount } from 'enzyme';
import { Field, Form, debounce, connectField } from '../../src';
import Input from '../fixtures/Input';

jest.useFakeTimers();

function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

describe('Field Error Debounce', () => {
  connectField('text', Input);

  const object = {
    name: 'John',
    schema: { name: { type: 'text', error: 'validate' } }
  };

  it('debounces the validation', () => {
    const callback = jest.fn().mockReturnValue(Promise.resolve());
    const validate = () => ({ debounce: 500, callback });

    function changeValue(value: string) {
      wrapper
        .find('input[name="name"]')
        .first()
        .simulate('change', { target: { value } });
    }

    const wrapper = mount(
      <Form for={{ ...object, validate }}>
        <Field name="name" />
      </Form>
    );

    changeValue('New value');

    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(0);

    changeValue('New value 2');
    jest.advanceTimersByTime(400);
    expect(callback).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  describe('that resolves', () => {
    it('shows validating message and then clears it', async () => {
      const validate = () => ({ debounce: 500, callback: async () => Promise.resolve() });

      const wrapper = mount(
        <Form for={{ ...object, validate }}>
          <Field name="name" />
        </Form>
      );

      expect.assertions(3);
      expect(wrapper.find('input').prop('data-validating')).toBeTruthy();

      jest.advanceTimersByTime(500);

      await flushPromises();
      wrapper.update();
      expect(wrapper.find('input').prop('data-validating')).toBeFalsy();
      expect(wrapper.find('input').prop('data-error')).toBeNull();
      wrapper.unmount();
    });
  });

  describe('that rejects', () => {
    it('shows validating message and then the error', async () => {
      const validate = () => ({
        debounce: 500,
        callback: async () => {
          throw new Error('async invalid');
        }
      });

      const wrapper = mount(
        <Form for={{ ...object, validate }}>
          <Field name="name" />
        </Form>
      );

      expect.assertions(3);
      expect(wrapper.find('input').prop('data-validating')).toBeTruthy();

      jest.advanceTimersByTime(500);

      await flushPromises();
      wrapper.update();
      expect(wrapper.find('input').prop('data-validating')).toBeFalsy();
      expect(wrapper.find('input').prop('data-error')).toEqual('async invalid');
      wrapper.unmount();
    });
  });
});
