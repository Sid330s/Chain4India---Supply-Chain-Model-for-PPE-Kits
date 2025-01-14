
import logging
import time

from sawtooth_processor_test.message_factory import MessageFactory

from supply_chain_processor.protobuf.payload_pb2 import SCPayload
from supply_chain_processor.protobuf.payload_pb2 import CreateAgentAction
from supply_chain_processor.protobuf.payload_pb2 import CreateProposalAction
from supply_chain_processor.protobuf.payload_pb2 import AnswerProposalAction
from supply_chain_processor.protobuf.payload_pb2 import CreateRecordAction
from supply_chain_processor.protobuf.payload_pb2 import \
    CreateRecordTypeAction
from supply_chain_processor.protobuf.payload_pb2 import FinalizeRecordAction
from supply_chain_processor.protobuf.payload_pb2 import \
    UpdatePropertiesAction
from supply_chain_processor.protobuf.payload_pb2 import RevokeReporterAction

from supply_chain_processor.protobuf.property_pb2 import PropertySchema
from supply_chain_processor.protobuf.property_pb2 import PropertyValue

import supply_chain_processor.addressing as addressing


LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.DEBUG)


class SupplyChainMessageFactory:
    def __init__(self, private=None, public=None):
        self._factory = MessageFactory(
            encoding='application/protobuf',
            family_name=addressing.FAMILY_NAME,
            family_version='1.0',
            namespace=addressing.NAMESPACE,
            private=private,
            public=public)

        self.public_key = self._factory.get_public_key()
        self.private_key = self._factory.get_private_key()
        self.signer_address = addressing.make_agent_address(self.public_key)

    def create_agent(self, name):
        payload = _make_sc_payload(
            action=SCPayload.CREATE_AGENT,
            create_agent=CreateAgentAction(name=name))

        return self._create_transaction(
            payload,
            [self.signer_address],
            [self.signer_address],
        )

    def create_record_type(self, name, *properties):
        payload = _make_sc_payload(
            action=SCPayload.CREATE_RECORD_TYPE,
            create_record_type=CreateRecordTypeAction(
                name=name,
                properties=[
                    PropertySchema(
                        name=name,
                        data_type=data_type,
                        required=required)
                    for (name, data_type, required) in properties
                ]
            )
        )

        record_type_address = addressing.make_record_type_address(name)

        return self._create_transaction(
            payload,
            inputs=[record_type_address, self.signer_address],
            outputs=[record_type_address],
        )

    def create_record(self, record_id, record_type, properties_dict):
        payload = _make_sc_payload(
            action=SCPayload.CREATE_RECORD,
            create_record=CreateRecordAction(
                record_id=record_id,
                record_type=record_type,
                properties=[
                    _make_property_value(name, value)
                    for name, value in properties_dict.items()
                ]
            )
        )

        record_address = addressing.make_record_address(record_id)
        record_type_address = addressing.make_record_type_address(record_type)
        property_address_range = \
            addressing.make_property_address_range(record_id)

        inputs = [
            record_address,
            record_type_address,
            property_address_range,
            self.signer_address,
        ]

        return self._create_transaction(
            payload,
            inputs=inputs,
            outputs=[
                record_address,
                property_address_range,
            ]
        )

    def finalize_record(self, record_id):
        payload = _make_sc_payload(
            action=SCPayload.FINALIZE_RECORD,
            finalize_record=FinalizeRecordAction(
                record_id=record_id))

        record_address = addressing.make_record_address(record_id)

        return self._create_transaction(
            payload,
            [record_address],
            [record_address]
        )

    def update_properties(self, record_id, properties_dict):
        payload = _make_sc_payload(
            action=SCPayload.UPDATE_PROPERTIES,
            update_properties=UpdatePropertiesAction(
                record_id=record_id,
                properties=[
                    _make_property_value(name, value)
                    for name, value in properties_dict.items()
                ]
            )
        )

        record_address = addressing.make_record_address(record_id)
        property_address_range = \
            addressing.make_property_address_range(record_id)

        inputs = [
            record_address,
            property_address_range,
        ]

        return self._create_transaction(
            payload,
            inputs=inputs,
            outputs=[property_address_range]
        )

    def create_proposal(self, record_id, receiving_agent,
                        role, properties=None):
        if properties is None:
            properties = []

        payload = _make_sc_payload(
            action=SCPayload.CREATE_PROPOSAL,
            create_proposal=CreateProposalAction(
                record_id=record_id,
                receiving_agent=receiving_agent,
                role=role,
                properties=properties))

        proposal_address = addressing.make_proposal_address(
            record_id,
            receiving_agent)

        receiving_address = addressing.make_agent_address(receiving_agent)

        record_address = addressing.make_record_address(record_id)

        return self._create_transaction(
            payload,
            inputs=[
                proposal_address,
                record_address,
                receiving_address,
                self.signer_address,
            ],
            outputs=[proposal_address],
        )

    def answer_proposal(self, record_id, receiving_agent, role, response):
        payload = _make_sc_payload(
            action=SCPayload.ANSWER_PROPOSAL,
            answer_proposal=AnswerProposalAction(
                record_id=record_id,
                receiving_agent=receiving_agent,
                role=role,
                response=response))

        proposal_address = addressing.make_proposal_address(
            record_id,
            receiving_agent)

        record_address = addressing.make_record_address(record_id)

        property_address_range = addressing.make_property_address_range(
            record_id)

        return self._create_transaction(
            payload,
            inputs=[
                proposal_address,
                record_address,
                property_address_range,
                addressing.RECORD_TYPE_ADDRESS_RANGE,
            ],
            outputs=[
                proposal_address,
                record_address,
                property_address_range,
            ],
        )

    def revoke_reporter(self, record_id, reporter_id, properties):
        payload = _make_sc_payload(
            action=SCPayload.REVOKE_REPORTER,
            revoke_reporter=RevokeReporterAction(
                record_id=record_id,
                reporter_id=reporter_id,
                properties=properties))

        record_address = addressing.make_record_address(record_id)

        proposal_address = addressing.make_proposal_address(
            record_id, reporter_id)

        property_addresses = [
            addressing.make_property_address(
                record_id, property_name)
            for property_name in properties
        ]

        return self._create_transaction(
            payload,
            inputs=[
                record_address,
                proposal_address,
                *property_addresses,
            ],
            outputs=[
                proposal_address,
                *property_addresses,
            ],
        )

    def make_empty_payload(self, public_key):
        address = addressing.make_agent_address(public_key)

        return self._create_transaction(
            payload=SCPayload().SerializeToString(),
            inputs=[address],
            outputs=[address]
        )

    def _create_transaction(self, payload, inputs, outputs):
        return self._factory.create_transaction(
            payload, inputs, outputs, [])

    def create_batch(self, transaction):
        return self._factory.create_batch([transaction])


def _make_sc_payload(**kwargs):
    return SCPayload(
        timestamp=round(time.time()),
        **kwargs
    ).SerializeToString()


def _make_property_value(name, value):
    property_value = PropertyValue(name=name)

    type_slots = {
        int: 'int_value',
        str: 'string_value',
        bytes: 'bytes_value',
        float: 'float_value',
    }

    type_tags = {
        int: PropertySchema.INT,
        str: PropertySchema.STRING,
        bytes: PropertySchema.BYTES,
        float: PropertySchema.FLOAT,
    }

    try:
        value_type = type(value)
        slot = type_slots[value_type]
        type_tag = type_tags[value_type]
    except KeyError:
        raise Exception('Unsupported type')

    setattr(property_value, slot, value)
    property_value.data_type = type_tag

    return property_value
