import React from 'react';
import { mount } from 'enzyme';
import { Field, Form } from '../../index';
import Input from '../fixture/Input';

describe('Stateless Form', () => {
  Field.connect('text', Input);

  const object = {
    name: 'initial',
    schema: { name: { type: 'text' } }
  };

  it('does not update field value on its own', () => {
    const wrapper = mount(
      <Form for={object} __testing_valid__>
        <Field name="name" />
      </Form>
    );

    wrapper
      .find('input')
      .first()
      .simulate('change', { target: { value: 'New value' } });

    const input = wrapper.find('input[name="name"]').first();
    expect(input.prop('value')).toEqual('initial');
  });
});