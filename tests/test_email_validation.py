import json
from io import BytesIO
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from urllib.error import HTTPError

from fastapi import HTTPException

from backend import main


class EmailValidationTests(unittest.TestCase):
    def setUp(self):
        self.api_key_patch = patch.object(
            main, "ABSTRACT_EMAIL_REPUTATION_API_KEY", "test-api-key"
        )
        self.api_key_patch.start()
        self.addCleanup(self.api_key_patch.stop)

    def validate_response(self, payload):
        response = BytesIO(json.dumps(payload).encode())
        with patch.object(main.urllib.request, "urlopen", return_value=response) as urlopen:
            main._validate_email_deliverability("person@example.com")
        request = urlopen.call_args.args[0]
        query = parse_qs(urlparse(request.full_url).query)
        self.assertEqual(
            urlparse(request.full_url).netloc, "emailreputation.abstractapi.com"
        )
        self.assertEqual(query["api_key"], ["test-api-key"])
        self.assertEqual(query["email"], ["person@example.com"])

    def test_accepts_email_reputation_response(self):
        self.validate_response({
            "email": "person@example.com",
            "deliverability": "DELIVERABLE",
            "is_valid_format": True,
            "is_mx_found": True,
            "is_smtp_valid": True,
            "is_disposable_email": False,
            "quality_score": 0.95,
        })

    def test_rejects_non_deliverable_or_disposable_reputation_response(self):
        for response in (
            {
                "deliverability": "UNDELIVERABLE",
                "is_valid_format": True,
                "is_mx_found": True,
                "is_smtp_valid": True,
                "is_disposable_email": False,
            },
            {
                "deliverability": "DELIVERABLE",
                "is_valid_format": True,
                "is_mx_found": True,
                "is_smtp_valid": True,
                "is_disposable_email": True,
            },
        ):
            with self.subTest(response=response):
                with self.assertRaises(HTTPException) as context:
                    self.validate_response(response)
                self.assertEqual(context.exception.status_code, 422)

    def test_accepts_abstract_current_deliverability_response(self):
        self.validate_response({
            "email_address": "person@example.com",
            "email_deliverability": {
                "status": "deliverable",
                "is_format_valid": True,
                "is_smtp_valid": True,
                "is_mx_valid": True,
            },
            "email_quality": {"is_disposable": False},
        })

    def test_accepts_abstract_legacy_response(self):
        self.validate_response({
            "is_valid_format": {"value": True},
            "is_mx_found": {"value": True},
            "is_smtp_valid": {"value": True},
            "is_disposable": {"value": False},
        })

    def test_rejects_non_deliverable_or_disposable_address(self):
        with self.assertRaises(HTTPException) as context:
            self.validate_response({
                "email_deliverability": {
                    "status": "undeliverable",
                    "is_format_valid": True,
                    "is_smtp_valid": False,
                    "is_mx_valid": True,
                },
                "email_quality": {"is_disposable": False},
            })
        self.assertEqual(context.exception.status_code, 422)

        with self.assertRaises(HTTPException) as context:
            self.validate_response({
                "email_deliverability": {
                    "status": "deliverable",
                    "is_format_valid": True,
                    "is_smtp_valid": True,
                    "is_mx_valid": True,
                },
                "email_quality": {"is_disposable": True},
            })
        self.assertEqual(context.exception.status_code, 422)

    def test_provider_failure_fails_registration_validation_closed(self):
        with patch.object(
            main.urllib.request,
            "urlopen",
            side_effect=TimeoutError("provider timeout"),
        ):
            with self.assertRaises(HTTPException) as context:
                main._validate_email_deliverability("person@example.com")
        self.assertEqual(context.exception.status_code, 503)

    def test_invalid_provider_key_is_reported_as_configuration_error(self):
        error = HTTPError(
            "https://emailvalidation.abstractapi.com/v1/",
            401,
            "Unauthorized",
            {},
            BytesIO(b""),
        )
        with patch.object(main.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(HTTPException) as context:
                main._validate_email_deliverability("person@example.com")
        self.assertEqual(context.exception.status_code, 503)
        self.assertIn("ABSTRACT_EMAIL_REPUTATION_API_KEY", context.exception.detail)

    def test_missing_api_key_does_not_call_provider(self):
        with (
            patch.object(main, "ABSTRACT_EMAIL_REPUTATION_API_KEY", ""),
            patch.object(main.urllib.request, "urlopen") as urlopen,
        ):
            with self.assertRaises(HTTPException) as context:
                main._validate_email_deliverability("person@example.com")
        self.assertEqual(context.exception.status_code, 503)
        urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
