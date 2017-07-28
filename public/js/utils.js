$("#videoIdFormGroup").hide();

$('[name="mediaType"]').change(function() {
  if($("#imageTypeRadio").prop("checked")) {
    $("#videoIdFormGroup").hide();
    $("#imageFileFormGroup").show();
  }
  else if($("#videoTypeRadio").prop("checked")) {
    $("#imageFileFormGroup").hide();
    $("#videoIdFormGroup").show();
  }
});
