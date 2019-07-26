import { Component, define } from '@xinix/xin';

export class View extends Component {
  get props () {
    return {
      ...super.props,

      parameters: {
        type: Object,
      },
    };
  }

  ready () {
    super.ready();

    this.setAttribute('xin-view', '');
  }

  focusing () {}

  focused () {}

  blurred () {}
}

define('xin-view', View);
