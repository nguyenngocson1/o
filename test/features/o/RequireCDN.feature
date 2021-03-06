Feature: Require CDN
  Background:
    Given I am on "/"
    And I am on "/test/fixtures/o/require/cdn/development.html#clear"
    And I am on "/"

  @javascript
  Scenario: I should be able to 'require' inline
    Given I am on "/test/fixtures/o/require/cdn/inline.html"
    And I execute "sleep 30"
    Then I should see "Hello World!"

  @javascript
  Scenario: It can run the bundled script
    Given I am on "/test/fixtures/o/require/cdn/development.html"
    Then I execute "sleep 30"
    Then I should see "Hello World!"

    And I am on "/"
    Then I am on "/test/fixtures/o/require/cdn/development.html#bundle"
    And I execute "sleep 3"

    And save the html in "pre" to "bundled.js"
    And I execute "cp ./test/results/bundled.js ./test/fixtures/bundled/bundled.js"
    And I execute "cp ./test/results/bundled.js ./test/fixtures/bundled/sub/bundled.js"
    # And I execute "head -n -1 ./test/results/bundled.js > ./test/results/bundled.trim.js"
    # And I execute "mv ./test/results/bundled.trim.js ./test/results/bundled.js"

    # Given I execute "make report /test/fixtures/o/require/cdn/development.html"
    # Then print the last error output
    # Then print the last output

    Given I am on "/test/fixtures/bundled/index.html"
    And I execute "sleep 3"
    Then I should see "Hello World! Hello World!"
